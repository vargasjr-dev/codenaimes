/**
 * Builds a compact, Wordle-style shareable game summary for X:
 *   I won! 🟦 3–2
 *
 *   🟦🟥⬜🟨⬜
 *   ...
 *
 *   🟦 1. WOOD 2 — draft 🟦, bark 🟦, pass
 *   🟥 2. METAL 3 — pilot 🟨
 *   play: https://...
 */

export type ShareEvent = {
  team: string | null;
  description: string;
  round: number;
};

const EMOJI: Record<string, string> = {
  red: "🟥",
  blue: "🟦",
  neutral: "🟨",
  assassin: "⬛",
};

/** Guess outcome markers: own square hit, opposing square miss, 🟨 neutral, ⬛ assassin */
function outcomeMarker(description: string, team: string): string | null {
  if (/— correct/.test(description)) return team === "red" ? "🟥" : "🟦";
  if (/ASSASSIN/.test(description)) return "⬛";
  const wrong = description.match(/— wrong \((\w+)\)/);
  if (wrong) return wrong[1] === "neutral" ? "🟨" : wrong[1] === "red" ? "🟥" : "🟦";
  if (/passed|treated as a pass/.test(description)) return "pass";
  return null;
}

export function buildShareText(opts: {
  words: string[];
  wordAssignments: Record<string, string>;
  revealedWords: string[];
  winner: string | null;
  myTeam: "red" | "blue" | null;
  events: ShareEvent[];
  gameUrl: string;
}): string {
  const { words, wordAssignments, revealedWords, winner, myTeam, events, gameUrl } = opts;

  // Board grid — colors are final either way
  const gridRows: string[] = [];
  for (let i = 0; i < words.length; i += 5) {
    gridRows.push(
      words
        .slice(i, i + 5)
        .map((w) => (revealedWords.includes(w) ? EMOJI[wordAssignments[w]] ?? "⬜" : "⬜"))
        .join(""),
    );
  }

  // Score = words each team revealed; mine first
  const redScore = words.filter((w) => wordAssignments[w] === "red" && revealedWords.includes(w)).length;
  const blueScore = words.filter((w) => wordAssignments[w] === "blue" && revealedWords.includes(w)).length;
  const score =
    myTeam === "red" ? `${redScore}–${blueScore}` : `${blueScore}–${redScore}`;
  const resultLine =
    myTeam && winner
      ? `I ${winner === myTeam ? "won" : "lost"}! ${EMOJI[myTeam]} ${score}`
      : `${winner === "red" ? "🟥" : "🟦"} ${score}`;

  // Group events into turns (one clue + its guesses per round, per team)
  type Turn = { team: string; clue: string | null; guesses: string[] };
  const turns: Turn[] = [];
  for (const ev of events) {
    const team = ev.team ?? "";
    const clueMatch = ev.description.match(/gave clue "([A-Z]+)" \((\d+)\)/);
    if (clueMatch) {
      turns.push({ team, clue: `${clueMatch[1]} ${clueMatch[2]}`, guesses: [] });
      continue;
    }
    const last = turns[turns.length - 1];
    if (!last || last.team !== team) continue;
    const wordMatch = ev.description.match(/guessed "([A-Z]+)"/);
    const marker = outcomeMarker(ev.description, team);
    if (wordMatch && marker) {
      last.guesses.push(`${wordMatch[1].toLowerCase()} ${marker}`);
    } else if (marker === "pass") {
      last.guesses.push("pass");
    }
  }

  const turnLines = turns.map((t, i) => {
    const badge = t.team === "red" ? "🟥" : "🟦";
    return `${badge} ${i + 1}. ${t.clue ?? "?"}${t.guesses.length ? " — " + t.guesses.join(", ") : ""}`;
  });

  return [
    resultLine,
    "",
    ...gridRows,
    ...(turnLines.length ? ["", ...turnLines] : []),
    "",
    `play: ${gameUrl}`,
  ].join("\n");
}
