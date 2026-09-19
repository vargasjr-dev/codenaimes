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
  score: { red: number; blue: number };
  finishedAt: string | null;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const mySeats = await db
    .select({ gameId: gamePlayers.gameId, team: gamePlayers.team, isAgent: gamePlayers.isAgent })
    .from(gamePlayers)
    .where(eq(gamePlayers.userId, user.id));

  if (mySeats.length === 0) {
    return NextResponse.json({ games: [] });
  }

  const rows = await db
    .select()
    .from(games)
    .where(inArray(games.id, mySeats.map((s) => s.gameId)))
    .orderBy(desc(games.updatedAt));

  // Agents are added under the adder's userId — always prefer the human seat
  // when determining which team the player was actually on.
  const teamByGame = new Map<string, "red" | "blue">();
  for (const seat of mySeats) {
    const existing = teamByGame.get(seat.gameId);
    if (!existing || !seat.isAgent) {
      teamByGame.set(seat.gameId, seat.team as "red" | "blue");
    }
  }

  const history: GameHistoryEntry[] = rows.map((g) => {
    const myTeam = teamByGame.get(g.id) ?? null;
    const result =
      g.status === "finished" && g.winner && myTeam
        ? g.winner === myTeam
          ? "win"
          : "loss"
        : null;

    // Score: how many words each team has revealed so far
    const assignments = (g.wordAssignments as Record<string, string>) ?? {};
    const revealed = (g.revealedWords as string[]) ?? [];
    const score = {
      red: Object.keys(assignments).filter((w) => assignments[w] === "red" && revealed.includes(w)).length,
      blue: Object.keys(assignments).filter((w) => assignments[w] === "blue" && revealed.includes(w)).length,
    };

    return {
      id: g.id,
      name: g.name,
      status: g.status,
      winner: g.winner,
      myTeam,
      result,
      score,
      finishedAt: (g.updatedAt ?? g.createdAt).toISOString(),
    };
  });

  return NextResponse.json({ games: history });
}
