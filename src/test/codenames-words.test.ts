import { describe, it, expect } from "vitest";
import { CODENAMES_WORDS, getRandomWords, generateWordAssignments } from "@/lib/codenames-words";

describe("getRandomWords", () => {
  it("returns the requested count of unique words from the standard list", () => {
    const words = getRandomWords(25);
    expect(words).toHaveLength(25);
    expect(new Set(words).size).toBe(25);
    for (const word of words) {
      expect(CODENAMES_WORDS).toContain(word);
    }
  });
});

describe("generateWordAssignments", () => {
  it("assigns every word exactly once with a valid type", () => {
    const words = getRandomWords(25);
    const assignments = generateWordAssignments(words, "red");

    const types = Object.values(assignments);
    expect(types.filter((t) => t === "red")).toHaveLength(9);
    expect(types.filter((t) => t === "blue")).toHaveLength(8);
    expect(types.filter((t) => t === "neutral")).toHaveLength(7);
    expect(types.filter((t) => t === "assassin")).toHaveLength(1);
    expect(Object.keys(assignments).sort()).toEqual([...words].sort());
  });

  it("gives the starting team the extra word regardless of team", () => {
    for (const startingTeam of ["red", "blue"] as const) {
      const assignments = generateWordAssignments(getRandomWords(25), startingTeam);
      const counts = Object.values(assignments).reduce(
        (acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }),
        {} as Record<string, number>,
      );
      expect(counts[startingTeam]).toBe(9);
      expect(counts[startingTeam === "red" ? "blue" : "red"]).toBe(8);
    }
  });
});
