import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games } from "@data/schema";
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
  if (game.status !== "waiting") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { team } = body;
  if (team !== "red" && team !== "blue") {
    return NextResponse.json({ error: "Team must be red or blue" }, { status: 400 });
  }

  const existingPlayers = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId));
  const teamCount = existingPlayers.filter((p) => p.team === team).length;
  if (teamCount >= 2) {
    return NextResponse.json({ error: "This team already has 2 players" }, { status: 400 });
  }

  if (body.addAgent) {
    // Fill the seat with a Jev agent instead of a human
    await db.insert(gamePlayers).values({
      gameId,
      userId: user.id,
      team,
      role: "pending",
      isAgent: true,
      agentDisplayName: "Jev",
    });
    return NextResponse.json({ success: true, agent: true });
  }

  await db.insert(gamePlayers).values({
    gameId,
    userId: user.id,
    team,
    role: "pending",
    isAgent: false,
  });

  return NextResponse.json({ success: true });
}
