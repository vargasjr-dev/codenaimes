/**
 * Builds a compact, Wordle-style shareable game summary:
 *   CodenAImes — Game Name
 *   🟥 Red 6 — 3 Blue 🟦  ·  Loss (Red)
 *   ⬜🟥🟦🟨⬜
 *   ...
 *   🟥 1. TIMBER 3 — draft ✓, bark ✗
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

function outcomeMarker(description: string): string {
  if (/— correct/.test(description)) return "✓";
  if (/— wrong|ASSASSIN/.test(description)) return "✗";
  if (/passed|treated as a pass/.test(description)) return "–";
  return "?";
}

export function buildShareText(opts: {
  gameName: string;
  words: string[];
  wordAssignments: Record<string, string>;
  revealedWords: string[];
  winner: string | null;
  myTeam: "red" | "blue" | null;
  events: ShareEvent[];
}): string {
  const { gameName, words, wordAssignments, revealedWords, winner, myTeam, events } = opts;

  // Board grid from the player's perspective — colors are final either way
  const gridRows: string[] = [];
  for (let i = 0; i < words.length; i += 5) {
    gridRows.push(
      words
        .slice(i, i + 5)
        .map((w) =>
          revealedWords.includes(w)
            ? EMOJI[wordAssignments[w]] ?? "⬜"
            : "⬜",
        )
        .join(""),
    );
  }

  // Score = words each team revealed
  const redScore = words.filter((w) => wordAssignments[w] === "red" && revealedWords.includes(w)).length;
  const blueScore = words.filter((w) => wordAssignments[w] === "blue" && revealedWords.includes(w)).length;

  const resultLine =
    myTeam && winner
      ? `${winner === "red" ? "🟥" : "🟦"} ${winner?.toUpperCase()} wins — ${
          winner === myTeam ? "Win" : "Loss"
        } for ${myTeam === "red" ? "🟥 Red" : "🟦 Blue"}`
      : winner
        ? `${winner === "red" ? "🟥" : "🟦"} ${winner?.toUpperCase()} wins`
        : "";

  // Clue → guesses for the player's team
  const myEvents = myTeam ? events.filter((e) => e.team === myTeam) : [];
  const rounds: Array<{ clue: string; guesses: string[] }> = [];
  for (const ev of myEvents) {
    const clueMatch = ev.description.match(/gave clue "([A-Z]+)" \((\d+)\)/);
    if (clueMatch) {
      rounds.push({ clue: `${clueMatch[1]} ${clueMatch[2]}`, guesses: [] });
      continue;
    }
    if (rounds.length > 0) {
      const wordMatch = ev.description.match(/guessed "([A-Z]+)"/);
      if (wordMatch) {
        rounds[rounds.length - 1].guesses.push(`${wordMatch[1].toLowerCase()} ${outcomeMarker(ev.description)}`);
      } else if (/passed|treated as a pass/.test(ev.description)) {
        rounds[rounds.length - 1].guesses.push("pass");
      }
    }
  }

  const clueLines = rounds.map(
    (r, i) => `${i + 1}. ${r.clue}${r.guesses.length ? " — " + r.guesses.join(", ") : " — no guesses"}`,
  );

  return [
    `CodenAImes — ${gameName}`,
    `🟥 Red ${redScore} — ${blueScore} Blue 🟦`,
    resultLine,
    "",
    ...gridRows,
    ...(clueLines.length ? ["", ...clueLines] : []),
  ].join("\n");
}
