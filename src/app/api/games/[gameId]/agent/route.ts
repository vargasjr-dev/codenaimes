import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { gamePlayers, games, users } from "@data/schema";
import { callVellumAgent } from "@/server/vellum";

type Body = {
  action?: "give_clue" | "make_guess";
  playerId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const { action, playerId } = await request.json() as Body;

  if (action !== "give_clue" && action !== "make_guess") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (typeof playerId !== "string" || !playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const [player] = await db.select().from(gamePlayers).where(eq(gamePlayers.id, playerId)).limit(1);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const [profile] = await db
    .select({ vellumApiKey: users.vellumApiKey })
    .from(users)
    .where(eq(users.id, player.userId))
    .limit(1);

  if (!profile?.vellumApiKey) {
    return NextResponse.json({ error: "Player missing Vellum API key in profile" }, { status: 400 });
  }
  if (!player.vellumAgentId) {
    return NextResponse.json({ error: "Player missing Vellum agent selection" }, { status: 400 });
  }

  const vellumApiKey = profile.vellumApiKey;

  const words = (game.words as string[]) ?? [];
  const wordAssignments = (game.wordAssignments as Record<string, string>) ?? {};
  const revealedWords = (game.revealedWords as string[]) ?? [];
  const unrevealedWords = words.filter((w) => !revealedWords.includes(w));

  if (action === "give_clue") {
    const teamWords = unrevealedWords.filter((w) => wordAssignments[w] === player.team);
    const opposingWords = unrevealedWords.filter(
      (w) => wordAssignments[w] !== player.team && wordAssignments[w] !== "neutral" && wordAssignments[w] !== "assassin",
    );
    const neutralWords = unrevealedWords.filter((w) => wordAssignments[w] === "neutral");
    const assassinWord = unrevealedWords.find((w) => wordAssignments[w] === "assassin");

    const prompt = `You are the spymaster in a game of Codenames. Your team is ${player.team}.

Your team's words (you want your operatives to guess these): ${teamWords.join(", ")}
Opposing team's words (avoid making operatives guess these): ${opposingWords.join(", ")}
Neutral words (avoid these, but they only end the turn): ${neutralWords.join(", ")}
Assassin word (NEVER give a clue that could lead to this): ${assassinWord}

Give a one-word clue and a number indicating how many words it relates to.
The clue MUST NOT be any word on the board or a derivative of any word on the board.
The clue must be a single word with no spaces, hyphens, or special characters.

Respond in this exact JSON format:
{"clue": "YOUR_CLUE", "number": N}

Think strategically - try to link multiple of your team's words while avoiding words that could lead to opposing team, neutral, or assassin words.`;

    const vellumResponse = await callVellumAgent(vellumApiKey, player.vellumAgentId, prompt);

    const clueMatch = vellumResponse.match(/\{[\s\S]*?"clue"[\s\S]*?:[\s\S]*?"([^"]+)"[\s\S]*?,[\s\S]*?"number"[\s\S]*?:[\s\S]*?(\d+)[\s\S]*?\}/);
    if (!clueMatch) {
      return NextResponse.json({ error: "Failed to parse clue from agent", raw: vellumResponse }, { status: 500 });
    }

    const clue = clueMatch[1].toUpperCase();
    const number = parseInt(clueMatch[2], 10);

    await db
      .update(games)
      .set({
        currentClue: clue,
        currentClueNumber: number,
        guessesRemaining: number + 1, // +1 bonus guess
        currentPhase: "operative_guess",
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));

    return NextResponse.json({ success: true, clue, number });
  }

  // make_guess
  const prompt = `You are an operative in a game of Codenames. Your team is ${player.team}.

Current clue: "${game.currentClue}" (${game.currentClueNumber} words)
Unrevealed words on the board: ${unrevealedWords.join(", ")}
Guesses remaining: ${game.guessesRemaining}

Based on the clue, guess ONE word from the unrevealed words that you think belongs to your team.
You can also choose to "PASS" if you're unsure and want to end your turn safely.

Respond in this exact JSON format:
{"guess": "YOUR_GUESS"} or {"guess": "PASS"}

The guess MUST be exactly one of the unrevealed words listed above, or "PASS".`;

  const vellumResponse = await callVellumAgent(vellumApiKey, player.vellumAgentId, prompt);

  const guessMatch = vellumResponse.match(/\{[\s\S]*?"guess"[\s\S]*?:[\s\S]*?"([^"]+)"[\s\S]*?\}/);
  if (!guessMatch) {
    return NextResponse.json({ error: "Failed to parse guess from agent", raw: vellumResponse }, { status: 500 });
  }

  const guess = guessMatch[1].toUpperCase();

  if (guess === "PASS") {
    const nextTeam = player.team === "red" ? "blue" : "red";
    await db
      .update(games)
      .set({
        currentTeam: nextTeam,
        currentPhase: "spymaster_clue",
        currentClue: null,
        currentClueNumber: null,
        guessesRemaining: null,
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));

    return NextResponse.json({ success: true, action: "pass", nextTeam });
  }

  const matchedWord = unrevealedWords.find((w) => w.toUpperCase() === guess);
  if (!matchedWord) {
    return NextResponse.json({ error: "Invalid guess - word not on board", guess }, { status: 400 });
  }

  const wordType = wordAssignments[matchedWord];
  const newRevealedWords = [...revealedWords, matchedWord];
  const endTurn = (extra: Record<string, unknown> = {}) =>
    db
      .update(games)
      .set({ updatedAt: new Date(), ...extra })
      .where(eq(games.id, gameId));

  if (wordType === "assassin") {
    const winner = player.team === "red" ? "blue" : "red";
    await endTurn({
      revealedWords: newRevealedWords,
      status: "finished",
      winner,
      currentPhase: "game_over",
    });
    return NextResponse.json({ success: true, action: "assassin", winner, guess: matchedWord });
  }

  const teamWordsRemaining = words.filter(
    (w) => wordAssignments[w] === player.team && !newRevealedWords.includes(w),
  ).length;
  if (teamWordsRemaining === 0) {
    await endTurn({
      revealedWords: newRevealedWords,
      status: "finished",
      winner: player.team,
      currentPhase: "game_over",
    });
    return NextResponse.json({ success: true, action: "win", winner: player.team, guess: matchedWord });
  }

  const opposingTeam = player.team === "red" ? "blue" : "red";
  const opposingWordsRemaining = words.filter(
    (w) => wordAssignments[w] === opposingTeam && !newRevealedWords.includes(w),
  ).length;
  if (opposingWordsRemaining === 0) {
    await endTurn({
      revealedWords: newRevealedWords,
      status: "finished",
      winner: opposingTeam,
      currentPhase: "game_over",
    });
    return NextResponse.json({ success: true, action: "opponent_win", winner: opposingTeam, guess: matchedWord });
  }

  if (wordType === player.team) {
    const newGuessesRemaining = (game.guessesRemaining ?? 1) - 1;
    if (newGuessesRemaining > 0) {
      await endTurn({ revealedWords: newRevealedWords, guessesRemaining: newGuessesRemaining });
      return NextResponse.json({
        success: true,
        action: "correct",
        guess: matchedWord,
        guessesRemaining: newGuessesRemaining,
      });
    }
  }

  const nextTeam = player.team === "red" ? "blue" : "red";
  await endTurn({
    revealedWords: newRevealedWords,
    currentTeam: nextTeam,
    currentPhase: "spymaster_clue",
    currentClue: null,
    currentClueNumber: null,
    guessesRemaining: null,
  });

  return NextResponse.json({
    success: true,
    action: wordType === player.team ? "turn_end" : "wrong",
    guess: matchedWord,
    nextTeam,
  });
}
