import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@data/db";
import { gameEvents } from "@data/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  const rows = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
    .orderBy(asc(gameEvents.createdAt));

  // Each clue starts a new round; guesses/passes belong to the round they follow
  let round = 0;
  const events = rows.map((e) => {
    if (/gave clue/.test(e.description)) round += 1;
    return { ...e, round };
  });

  return NextResponse.json({ events, round });
}
