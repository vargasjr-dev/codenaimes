import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games } from "@data/schema";
import { getCurrentUser } from "@/server/auth";

export type GameHistoryEntry = {
  id: string;
  name: string;
  status: string;
  winner: string | null;
  myTeam: "red" | "blue" | null;
  result: "win" | "loss" | null;
  finishedAt: string | null;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const mySeats = await db
    .select({ gameId: gamePlayers.gameId, team: gamePlayers.team })
    .from(gamePlayers)
    .where(eq(gamePlayers.userId, user.id));

  if (mySeats.length === 0) {
    return NextResponse.json({ games: [] });
  }

  const rows = await db
    .select({
      id: games.id,
      name: games.name,
      status: games.status,
      winner: games.winner,
      updatedAt: games.updatedAt,
      createdAt: games.createdAt,
    })
    .from(games)
    .where(inArray(games.id, mySeats.map((s) => s.gameId)))
    .orderBy(desc(games.updatedAt));

  const teamByGame = new Map(mySeats.map((s) => [s.gameId, s.team as "red" | "blue"]));

  const history: GameHistoryEntry[] = rows.map((g) => {
    const myTeam = teamByGame.get(g.id) ?? null;
    const result =
      g.status === "finished" && g.winner && myTeam
        ? g.winner === myTeam
          ? "win"
          : "loss"
        : null;
    return {
      id: g.id,
      name: g.name,
      status: g.status,
      winner: g.winner,
      myTeam,
      result,
      finishedAt: (g.updatedAt ?? g.createdAt).toISOString(),
    };
  });

  return NextResponse.json({ games: history });
}
