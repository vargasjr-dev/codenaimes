import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@data/db";
import { gameEvents } from "@data/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  const events = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
    .orderBy(asc(gameEvents.createdAt));

  return NextResponse.json({ events });
}
