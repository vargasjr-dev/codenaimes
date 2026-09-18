import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gameEvents, gamePlayers, games } from "@data/schema";
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

  // Recent move history so the agent knows what was clued and guessed before
  const recentEvents = await db
    .select({ description: gameEvents.description })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
    .orderBy(gameEvents.createdAt);
  const historyLines = recentEvents.length
    ? recentEvents.map((e) => e.description)
    : ["(no moves yet)"];

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

    const state = {
      role: "spymaster",
      team: player.team,
      yourTeamWords: teamWords,
      opposingTeamWords: opposingWords,
      neutralWords,
      assassinWord: assassinWord ?? null,
      unrevealedWords,
      revealedWords,
      moveHistory: historyLines,
    };

    // One Choice question per candidate clue; the options are the board
    // words. Each answer's probability distribution over the board is scored
    // deterministically against the spymaster's allegiances, and the best
    // candidate wins. Jev never sees which word belongs to which team — the
    // scoring happens in code.
    const candidates = candidateClues(unrevealedWords);
    const questions: Record<string, {
      type: "choice";
      instructions: string;
      criteria: Record<string, string | null>;
    }> = {};
    for (const candidate of candidates) {
      questions[`cand_${candidate}`] = {
        type: "choice",
        instructions: `Which board word is most strongly associated with the word "${candidate}"?`,
        criteria: Object.fromEntries(unrevealedWords.map((w) => [w, null])),
      };
    }

    const answers = await askJev(state, questions);

    const OPPOSING_PENALTY = 1;
    const NEUTRAL_PENALTY = 0.5;
    const ASSASSIN_PENALTY = 3;

    let bestCandidate: string | null = null;
    let bestScore = -Infinity;
    let bestDistribution: Record<string, number> = {};

    for (const candidate of candidates) {
      const answer = answers[`cand_${candidate}`];
      if (!answer || answer.type !== "choice") continue;

      const dist = answer.probabilities;
      let score = 0;
      for (const word of unrevealedWords) {
        const p = dist[word] ?? 0;
        if (teamWords.includes(word)) score += p;
        else if (word === assassinWord) score -= ASSASSIN_PENALTY * p;
        else if (opposingWords.includes(word)) score -= OPPOSING_PENALTY * p;
        else if (neutralWords.includes(word)) score -= NEUTRAL_PENALTY * p;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
        bestDistribution = dist;
      }
    }

    if (!bestCandidate) {
      return NextResponse.json({ error: "Failed to get a clue from Jev" }, { status: 500 });
    }

    // Deterministic count: how many team words land in the distribution's top 3
    const topWords = [...unrevealedWords]
      .sort((a, b) => (bestDistribution[b] ?? 0) - (bestDistribution[a] ?? 0))
      .slice(0, 3);
    const number = Math.max(1, topWords.filter((w) => teamWords.includes(w)).length);
    const clue = bestCandidate.toUpperCase();

    await db
      .update(games)
      .set({
        currentClue: clue,
        currentClueNumber: number,
        guessesRemaining: number, // exact words
        currentPhase: "operative_guess",
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));

    await db.insert(gameEvents).values({
      gameId,
      team: player.team,
      description: `${player.agentDisplayName ?? "Jev"} AI gave clue "${clue}" (${number})`,
    });

    return NextResponse.json({
      success: true,
      clue,
      number,
      score: bestScore,
      topWords,
    });
  }

  // make_guess
  const state = {
    role: "operative",
    team: player.team,
    clue: {
      word: game.currentClue,
      number: game.currentClueNumber,
      guessesRemaining: game.guessesRemaining ?? 0,
    },
    unrevealedWords,
    revealedWords,
    moveHistory: historyLines,
  };

  const answers = await askJev(state, {
    guess: {
      type: "choice",
      instructions:
        `Which unrevealed word is most strongly associated with the clue "${game.currentClue}"? ` +
        `Consider every unrevealed word and pick the single best match.`,
      criteria: Object.fromEntries(unrevealedWords.map((w) => [w, null])),
    },
    should_guess: {
      type: "noul",
      instructions:
        `Is there at least one unrevealed word on the board strongly enough associated ` +
        `with the clue "${game.currentClue}" to justify making a guess this turn?`,
      criteria: {
        "true": "Yes — at least one board word is a good match for the clue",
        "false": "No — nothing on the board fits the clue well; passing is the better play",
      },
    },
  });

  const guessAnswer = answers.guess;
  if (!guessAnswer || guessAnswer.type !== "choice") {
    return NextResponse.json({ error: "Failed to get a guess from Jev" }, { status: 500 });
  }

  const guess = guessAnswer.choice.toUpperCase();

  const logGuess = async (description: string) => {
    await db.insert(gameEvents).values({
      gameId,
      team: player.team,
      description,
    });
  };

  const matchedWord = unrevealedWords.find((w) => w.toUpperCase() === guess);

  // Defensive pass handling. Jev reads the move history literally and
  // sometimes answers "PASS" (or an off-board word) even when it isn't a
  // criteria option — documented "literal reading" failure mode. Rather than
  // erroring out mid-turn, treat it as a pass.
  if (guess === "PASS" || !matchedWord) {
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

    await logGuess(
      guess === "PASS"
        ? `${player.agentDisplayName ?? "Jev"} AI passed`
        : `${player.agentDisplayName ?? "Jev"} AI answered "${guess}", which is not on the board — treated as a pass`,
    );

    return NextResponse.json({ success: true, action: "pass", nextTeam });
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
    await logGuess(`${player.agentDisplayName ?? "Jev"} AI guessed "${matchedWord}" — ASSASSIN! ${winner} wins`);
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
    await logGuess(`${player.agentDisplayName ?? "Jev"} AI guessed "${matchedWord}" — ${player.team} wins!`);
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
    await logGuess(`${player.agentDisplayName ?? "Jev"} AI guessed "${matchedWord}" — revealed the last ${opposingTeam} word, ${opposingTeam} wins`);
    return NextResponse.json({ success: true, action: "opponent_win", winner: opposingTeam, guess: matchedWord });
  }

  if (wordType === player.team) {
    const newGuessesRemaining = (game.guessesRemaining ?? 1) - 1;
    if (newGuessesRemaining > 0) {
      await endTurn({ revealedWords: newRevealedWords, guessesRemaining: newGuessesRemaining });
      await logGuess(`${player.agentDisplayName ?? "Jev"} AI guessed "${matchedWord}" — correct! (${newGuessesRemaining} left)`);
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

  await logGuess(
    wordType === player.team
      ? `${player.agentDisplayName ?? "Jev"} AI guessed "${matchedWord}" — correct, but out of guesses`
      : `${player.agentDisplayName ?? "Jev"} AI guessed "${matchedWord}" — wrong (${wordType})`,
  );

  return NextResponse.json({
    success: true,
    action: wordType === player.team ? "turn_end" : "wrong",
    guess: matchedWord,
    nextTeam,
  });
}
