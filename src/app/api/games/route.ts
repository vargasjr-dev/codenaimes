import { NextResponse } from "next/server";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games } from "@data/schema";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const lobbyGames = await db
    .select()
    .from(games)
    .where(inArray(games.status, ["waiting", "in_progress"]))
    .orderBy(desc(games.createdAt));

  const counts: Record<string, number> = {};
  if (lobbyGames.length > 0) {
    const playerRows = await db
      .select({ gameId: gamePlayers.gameId, count: sql<number>`count(*)::int` })
      .from(gamePlayers)
      .where(inArray(gamePlayers.gameId, lobbyGames.map((g) => g.id)))
      .groupBy(gamePlayers.gameId);

    for (const row of playerRows) {
      counts[row.gameId] = row.count;
    }
  }

  return NextResponse.json({ games: lobbyGames, playerCounts: counts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Game";

  const [game] = await db
    .insert(games)
    .values({ name, hostUserId: user.id, status: "waiting" })
    .returning();

  // Auto-join the host as the first player on the red team
  await db.insert(gamePlayers).values({
    gameId: game.id,
    userId: user.id,
    team: "red",
    role: "pending",
    isAgent: false,
  });

  return NextResponse.json({ game });
}
