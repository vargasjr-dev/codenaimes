import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games } from "@data/schema";
import { getCurrentUser } from "@/server/auth";

const QUICK_FILL_NAMES = ["Alpha Agent", "Beta Agent", "Gamma Agent", "Delta Agent"];

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
  const existingPlayers = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId));

  if (body.quickFill) {
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    if (typeof body.vellumAgentId !== "string" || !body.vellumAgentId) {
      return NextResponse.json({ error: "vellumAgentId is required" }, { status: 400 });
    }

    const spots = [
      { team: "red", index: 0 },
      { team: "red", index: 1 },
      { team: "blue", index: 2 },
      { team: "blue", index: 3 },
    ];
    const availableSpots = spots.filter((spot) => {
      const teamCount = existingPlayers.filter((p) => p.team === spot.team).length;
      return teamCount < 2;
    });

    if (availableSpots.length === 0) {
      return NextResponse.json({ error: "All spots filled" }, { status: 400 });
    }

    await db.insert(gamePlayers).values(
      availableSpots.map((spot) => ({
        gameId,
        userId: user.id,
        team: spot.team,
        role: "pending",
        vellumAgentId: body.vellumAgentId,
        agentDisplayName: QUICK_FILL_NAMES[spot.index],
      })),
    );

    return NextResponse.json({ success: true, added: availableSpots.length });
  }

  const { team, vellumAgentId, agentDisplayName } = body;
  if (team !== "red" && team !== "blue") {
    return NextResponse.json({ error: "Team must be red or blue" }, { status: 400 });
  }
  if (typeof vellumAgentId !== "string" || !vellumAgentId) {
    return NextResponse.json({ error: "Agent selection is required" }, { status: 400 });
  }
  if (typeof agentDisplayName !== "string" || !agentDisplayName.trim()) {
    return NextResponse.json({ error: "Agent display name is required" }, { status: 400 });
  }

  const teamCount = existingPlayers.filter((p) => p.team === team).length;
  if (teamCount >= 2) {
    return NextResponse.json({ error: "This team already has 2 players" }, { status: 400 });
  }

  await db.insert(gamePlayers).values({
    gameId,
    userId: user.id,
    team,
    role: "pending",
    vellumAgentId,
    agentDisplayName: agentDisplayName.trim(),
  });

  return NextResponse.json({ success: true });
}
