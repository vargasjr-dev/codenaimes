import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gameEvents, gamePlayers, games } from "@data/schema";
import { getCurrentUser } from "@/server/auth";
import { AGENT_NAMES } from "@/lib/agent-names";

/** Random, unique agent names — shuffled from the pool of unused entries. */
function pickAgentNames(count: number, taken: Set<string>): string[] {
  const available: string[] = AGENT_NAMES.filter((n) => !taken.has(n.toLowerCase()));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  const names = available.slice(0, count);
  while (names.length < count) {
    names.push(`Agent ${names.length + 1}`);
  }
  return names;
}

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

  // Fill every remaining seat (both teams) with agents
  if (body.fillRemaining) {
    const seats: Array<"red" | "blue"> = [];
    for (const t of ["red", "blue"] as const) {
      const count = existingPlayers.filter((p) => p.team === t).length;
      for (let i = count; i < 2; i++) seats.push(t);
    }
    if (seats.length === 0) {
      return NextResponse.json({ error: "No empty seats" }, { status: 400 });
    }

    const takenNames = new Set(
      existingPlayers
        .filter((p) => p.isAgent)
        .map((p) => p.agentDisplayName?.toLowerCase() ?? ""),
    );
    const names = pickAgentNames(seats.length, takenNames);

    await db.insert(gamePlayers).values(
      seats.map((team, i) => ({
        gameId,
        userId: user.id,
        team,
        role: "pending" as const,
        isAgent: true,
        agentDisplayName: names[i],
      })),
    );

    return NextResponse.json({ success: true, added: seats.length });
  }

  const { team } = body;
  if (team !== "red" && team !== "blue") {
    return NextResponse.json({ error: "Team must be red or blue" }, { status: 400 });
  }

  const teamCount = existingPlayers.filter((p) => p.team === team).length;
  if (teamCount >= 2) {
    return NextResponse.json({ error: "This team already has 2 players" }, { status: 400 });
  }

  if (body.addAgent) {
    // Fill the seat with an agent under a random unused name
    const takenNames = new Set(
      existingPlayers
        .filter((p) => p.isAgent)
        .map((p) => p.agentDisplayName?.toLowerCase() ?? ""),
    );
    const [agentName] = pickAgentNames(1, takenNames);

    await db.insert(gamePlayers).values({
      gameId,
      userId: user.id,
      team,
      role: "pending",
      isAgent: true,
      agentDisplayName: agentName,
    });
    return NextResponse.json({ success: true, agent: true, name: agentName });
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
