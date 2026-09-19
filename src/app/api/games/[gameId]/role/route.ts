import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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
    return NextResponse.json({ error: "Roles are locked once the game starts" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const role = body.role;
  if (role !== "spymaster" && role !== "operative") {
    return NextResponse.json({ error: "Role must be spymaster or operative" }, { status: 400 });
  }

  const updated = await db
    .update(gamePlayers)
    .set({ role })
    .where(
      and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.userId, user.id),
        eq(gamePlayers.isAgent, false),
      ),
    )
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "You are not seated in this game" }, { status: 400 });
  }

  return NextResponse.json({ success: true, role });
}
