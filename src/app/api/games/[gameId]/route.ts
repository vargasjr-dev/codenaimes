import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games, users } from "@data/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const players = await db
    .select({
      id: gamePlayers.id,
      userId: gamePlayers.userId,
      team: gamePlayers.team,
      role: gamePlayers.role,
      isAgent: gamePlayers.isAgent,
      agentDisplayName: gamePlayers.agentDisplayName,
      username: users.username,
    })
    .from(gamePlayers)
    .innerJoin(users, eq(gamePlayers.userId, users.id))
    .where(eq(gamePlayers.gameId, gameId));

  return NextResponse.json({ game, players });
}
