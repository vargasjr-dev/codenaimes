import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@data/db";
import { gameEvents, gamePlayers, games } from "@data/schema";
import { getCurrentUser } from "@/server/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const guessWord = typeof body.word === "string" ? body.word.toUpperCase().trim() : "";
  if (!guessWord) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "in_progress") {
    return NextResponse.json({ error: "Game is not in progress" }, { status: 400 });
  }

  const [player] = await db
    .select()
    .from(gamePlayers)
    .where(
      and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.userId, user.id),
        eq(gamePlayers.isAgent, false),
      ),
    )
    .limit(1);
  if (!player) {
    return NextResponse.json({ error: "You are not seated in this game" }, { status: 403 });
  }
  if (player.team !== game.currentTeam) {
    return NextResponse.json({ error: "Not your team's turn" }, { status: 400 });
  }
  if (game.currentPhase !== "operative_guess") {
    return NextResponse.json({ error: "Waiting for a clue" }, { status: 400 });
  }
  if (player.role === "spymaster") {
    return NextResponse.json({ error: "The spymaster cannot guess" }, { status: 400 });
  }

  const words = (game.words as string[]) ?? [];
  const wordAssignments = (game.wordAssignments as Record<string, string>) ?? {};
  const revealedWords = (game.revealedWords as string[]) ?? [];
  const unrevealedWords = words.filter((w) => !revealedWords.includes(w));

  const matchedWord = unrevealedWords.find((w) => w.toUpperCase() === guessWord);
  if (!matchedWord) {
    return NextResponse.json({ error: "Word is not on the board" }, { status: 400 });
  }

  const logGuess = async (description: string) => {
    await db.insert(gameEvents).values({
      gameId,
      team: player.team,
      description,
    });
  };

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
    await logGuess(`${user.username} guessed "${matchedWord}" — ASSASSIN! ${winner} wins`);
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
    await logGuess(`${user.username} guessed "${matchedWord}" — ${player.team} wins!`);
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
    await logGuess(`${user.username} guessed "${matchedWord}" — revealed the last ${opposingTeam} word, ${opposingTeam} wins`);
    return NextResponse.json({ success: true, action: "opponent_win", winner: opposingTeam, guess: matchedWord });
  }

  if (wordType === player.team) {
    const newGuessesRemaining = (game.guessesRemaining ?? 1) - 1;
    if (newGuessesRemaining > 0) {
      await endTurn({ revealedWords: newRevealedWords, guessesRemaining: newGuessesRemaining });
      await logGuess(`${user.username} guessed "${matchedWord}" — correct! (${newGuessesRemaining} left)`);
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
      ? `${user.username} guessed "${matchedWord}" — correct, but that was the last guess of the clue`
      : wordType === "neutral"
        ? `${user.username} guessed "${matchedWord}" — neutral word, turn passes`
        : `${user.username} guessed "${matchedWord}" — that's an ${opposingTeam} word, turn passes`,
  );

  return NextResponse.json({ success: true, action: "miss", guess: matchedWord, nextTeam });
}
