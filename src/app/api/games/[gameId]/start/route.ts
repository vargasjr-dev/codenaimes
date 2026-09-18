import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games } from "@data/schema";
import { getCurrentUser } from "@/server/auth";
import { getRandomWords, generateWordAssignments } from "@/lib/codenames-words";

export async function POST(
  _request: Request,
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
  if (game.hostUserId !== user.id) {
    return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
  }
  if (game.status !== "waiting") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
  const redPlayers = players.filter((p) => p.team === "red");
  const bluePlayers = players.filter((p) => p.team === "blue");
  if (redPlayers.length < 2 || bluePlayers.length < 2) {
    return NextResponse.json(
      { error: "Need 2 players on each team (4 total)" },
      { status: 400 },
    );
  }

  // Auto-assign roles: first player on each team becomes spymaster, second operative
  for (const [index, player] of redPlayers.slice(0, 2).entries()) {
    await db.update(gamePlayers).set({ role: index === 0 ? "spymaster" : "operative" }).where(eq(gamePlayers.id, player.id));
  }
  for (const [index, player] of bluePlayers.slice(0, 2).entries()) {
    await db.update(gamePlayers).set({ role: index === 0 ? "spymaster" : "operative" }).where(eq(gamePlayers.id, player.id));
  }

  const words = getRandomWords(25);
  const startingTeam = Math.random() > 0.5 ? "red" : "blue";
  const assignments = generateWordAssignments(words, startingTeam);

  await db
    .update(games)
    .set({
      status: "in_progress",
      words,
      wordAssignments: assignments,
      revealedWords: [],
      currentTeam: startingTeam,
      currentPhase: "spymaster_clue",
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId));

  return NextResponse.json({ success: true });
}
