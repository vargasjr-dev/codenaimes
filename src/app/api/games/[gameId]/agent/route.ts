import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games } from "@data/schema";
import { askJev, candidateClues } from "@/server/jev";

type Body = {
  action?: "give_clue" | "make_guess";
  playerId?: string;
};

type WordAssignments = Record<string, string>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const { action, playerId } = await request.json() as Body;

  if (action !== "give_clue" && action !== "make_guess") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (typeof playerId !== "string" || !playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const [player] = await db.select().from(gamePlayers).where(eq(gamePlayers.id, playerId)).limit(1);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (!player.isAgent) {
    return NextResponse.json({ error: "Player is not an agent" }, { status: 400 });
  }

  const words = (game.words as string[]) ?? [];
  const wordAssignments = (game.wordAssignments as WordAssignments) ?? {};
  const revealedWords = (game.revealedWords as string[]) ?? [];
  const unrevealedWords = words.filter((w) => !revealedWords.includes(w));

  if (action === "give_clue") {
    const teamWords = unrevealedWords.filter((w) => wordAssignments[w] === player.team);
    const opposingWords = unrevealedWords.filter(
      (w) => wordAssignments[w] !== player.team && wordAssignments[w] !== "neutral" && wordAssignments[w] !== "assassin",
    );
    const neutralWords = unrevealedWords.filter((w) => wordAssignments[w] === "neutral");
    const assassinWord = unrevealedWords.find((w) => wordAssignments[w] === "assassin");

    if (teamWords.length === 0) {
      return NextResponse.json({ error: "No team words left to clue" }, { status: 400 });
    }

    const state = [
      `You are the spymaster in a game of Codenames for the ${player.team} team.`,
      `Your team's unrevealed words: ${teamWords.join(", ")}`,
      `Opposing team's words (avoid): ${opposingWords.join(", ")}`,
      `Neutral words (avoid): ${neutralWords.join(", ")}`,
      `Assassin word (never lead operatives to): ${assassinWord ?? "none"}`,
    ].join("\n");

    // Jev cannot generate text, so it picks the best clue from a legal
    // candidate vocabulary, then rates how many words the clue should link.
    const candidates = candidateClues(unrevealedWords);
    const answers = await askJev(state, {
      clue: {
        type: "choice",
        instructions:
          "Pick the one word that would make the best clue for your operatives — " +
          "strongly associated with your team's words, and NOT associated with the " +
          "opposing, neutral, or assassin words.",
        criteria: Object.fromEntries(candidates.map((c) => [c, `Candidate clue word "${c}"`])),
      },
      clue_number: {
        type: "score",
        instructions:
          "How many of your team's words does the chosen clue relate to? " +
          "Be conservative — a wrong guess ends your team's turn.",
        criteria: ["one word", "two words", "three or more words"],
      },
    });

    const clueAnswer = answers.clue;
    const numberAnswer = answers.clue_number;

    if (!clueAnswer || clueAnswer.type !== "choice") {
      return NextResponse.json({ error: "Failed to get a clue from Jev" }, { status: 500 });
    }

    const clue = clueAnswer.choice.toUpperCase();
    const number = numberAnswer?.type === "score" ? Math.max(1, Math.min(3, Math.round(numberAnswer.score))) : 1;

    await db
      .update(games)
      .set({
        currentClue: clue,
        currentClueNumber: number,
        guessesRemaining: number + 1, // +1 bonus guess
        currentPhase: "operative_guess",
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));

    return NextResponse.json({ success: true, clue, number, confidence: clueAnswer.confidence });
  }

  // make_guess
  const state = [
    `You are an operative in a game of Codenames for the ${player.team} team.`,
    `Current clue: "${game.currentClue}" (${game.currentClueNumber} words)`,
    `Guesses remaining this turn: ${game.guessesRemaining ?? 0}`,
    `Unrevealed words on the board: ${unrevealedWords.join(", ")}`,
  ].join("\n");

  const options: Record<string, string | null> = Object.fromEntries(
    unrevealedWords.map((w) => [w, null]),
  );
  options["PASS"] = "End the turn safely without guessing";

  const answers = await askJev(state, {
    guess: {
      type: "choice",
      instructions:
        `Which unrevealed word is most likely to belong to your team based on the clue ` +
        `"${game.currentClue}"? Choose PASS if no word fits well.`,
      criteria: options,
    },
  });

  const guessAnswer = answers.guess;
  if (!guessAnswer || guessAnswer.type !== "choice") {
    return NextResponse.json({ error: "Failed to get a guess from Jev" }, { status: 500 });
  }

  const guess = guessAnswer.choice.toUpperCase();

  if (guess === "PASS") {
    const nextTeam = player.team === "red" ? "blue" : "red";
    await db
      .update(games)
      .set({
        currentTeam: nextTeam,
        currentPhase: "spymaster_clue",
        currentClue: null,
        currentClueNumber: null,
        guessesRemaining: null,
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));

    return NextResponse.json({ success: true, action: "pass", nextTeam });
  }

  const matchedWord = unrevealedWords.find((w) => w.toUpperCase() === guess);
  if (!matchedWord) {
    return NextResponse.json({ error: "Invalid guess - word not on board", guess }, { status: 400 });
  }

  const wordType = wordAssignments[matchedWord];
  const newRevealedWords = [...revealedWords, matchedWord];
  const endTurn = (extra: Record<string, unknown> = {}) =>
    db
      .update(games)
      .set({ updatedAt: new Date(), ...extra })
      .where(eq(games.id, gameId));

  if (wordType === "assassin") {
    const winner = player.team === "red" ? "blue" : "red";
    await endTurn({
      revealedWords: newRevealedWords,
      status: "finished",
      winner,
      currentPhase: "game_over",
    });
    return NextResponse.json({ success: true, action: "assassin", winner, guess: matchedWord });
  }

  const teamWordsRemaining = words.filter(
    (w) => wordAssignments[w] === player.team && !newRevealedWords.includes(w),
  ).length;
  if (teamWordsRemaining === 0) {
    await endTurn({
      revealedWords: newRevealedWords,
      status: "finished",
      winner: player.team,
      currentPhase: "game_over",
    });
    return NextResponse.json({ success: true, action: "win", winner: player.team, guess: matchedWord });
  }

  const opposingTeam = player.team === "red" ? "blue" : "red";
  const opposingWordsRemaining = words.filter(
    (w) => wordAssignments[w] === opposingTeam && !newRevealedWords.includes(w),
  ).length;
  if (opposingWordsRemaining === 0) {
    await endTurn({
      revealedWords: newRevealedWords,
      status: "finished",
      winner: opposingTeam,
      currentPhase: "game_over",
    });
    return NextResponse.json({ success: true, action: "opponent_win", winner: opposingTeam, guess: matchedWord });
  }

  if (wordType === player.team) {
    const newGuessesRemaining = (game.guessesRemaining ?? 1) - 1;
    if (newGuessesRemaining > 0) {
      await endTurn({ revealedWords: newRevealedWords, guessesRemaining: newGuessesRemaining });
      return NextResponse.json({
        success: true,
        action: "correct",
        guess: matchedWord,
        guessesRemaining: newGuessesRemaining,
      });
    }
  }

  const nextTeam = player.team === "red" ? "blue" : "red";
  await endTurn({
    revealedWords: newRevealedWords,
    currentTeam: nextTeam,
    currentPhase: "spymaster_clue",
    currentClue: null,
    currentClueNumber: null,
    guessesRemaining: null,
  });

  return NextResponse.json({
    success: true,
    action: wordType === player.team ? "turn_end" : "wrong",
    guess: matchedWord,
    nextTeam,
  });
}
