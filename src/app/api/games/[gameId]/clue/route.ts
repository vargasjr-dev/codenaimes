import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "in_progress") {
    return NextResponse.json({ error: "Game is not in progress" }, { status: 400 });
  }
  if (game.currentPhase !== "spymaster_clue") {
    return NextResponse.json({ error: "It is not clue time" }, { status: 400 });
  }

  const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
  const spymaster = players.find(
    (p) => p.team === game.currentTeam && p.role === "spymaster",
  );
  if (!spymaster) {
    return NextResponse.json({ error: "Spymaster not found" }, { status: 400 });
  }
  if (spymaster.userId !== user.id) {
    return NextResponse.json({ error: "You are not the spymaster" }, { status: 403 });
  }
  if (spymaster.isAgent) {
    return NextResponse.json({ error: "Use the Step button for agent turns" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const word = typeof body.word === "string" ? body.word.trim().toUpperCase() : "";
  const number = Number(body.number);

  if (!word || !/^[A-Z]+$/.test(word)) {
    return NextResponse.json({ error: "Clue must be a single word (letters only)" }, { status: 400 });
  }
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: "Number must be at least 1" }, { status: 400 });
  }

  // Clue number cannot exceed the team's unrevealed words
  const boardWords = ((game.words as string[]) ?? []).map((w) => w.toUpperCase());
  const assignments = (game.wordAssignments as Record<string, string>) ?? {};
  const revealed = ((game.revealedWords as string[]) ?? []).map((w) => w.toUpperCase());
  const teamRemaining = boardWords.filter(
    (w) => assignments[w] === game.currentTeam && !revealed.includes(w),
  ).length;
  if (number > teamRemaining) {
    return NextResponse.json(
      { error: `Only ${teamRemaining} of your team's words remain` },
      { status: 400 },
    );
  }
  if (boardWords.includes(word)) {
    return NextResponse.json({ error: "Clue cannot be a word on the board" }, { status: 400 });
  }

  // Clues already given this game are off the table
  const clueEvents = await db
    .select({ description: gameEvents.description })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId));
  const usedClues = new Set(
    clueEvents
      .map((e) => e.description.match(/gave clue "([A-Z]+)"/)?.[1])
      .filter(Boolean)
      .map((c) => (c as string).toLowerCase()),
  );
  if (usedClues.has(word.toLowerCase())) {
    return NextResponse.json({ error: "That clue was already used this game" }, { status: 400 });
  }

  await db
    .update(games)
    .set({
      currentClue: word,
      currentClueNumber: number,
      guessesRemaining: number, // exact words
      currentPhase: "operative_guess",
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId));

  await db.insert(gameEvents).values({
    gameId,
    team: game.currentTeam,
    description: `${user.username} gave clue "${word}" (${number})`,
  });

  return NextResponse.json({ success: true, clue: word, number });
}
