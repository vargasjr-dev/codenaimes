/**
 * Jev (TypeSafe System One) client for CodenAImes.
 *
 * Jev does not generate text — it evaluates typed questions (noul / choice /
 * score) against a state block and returns structured answers with calibrated
 * probabilities. Both agent roles are therefore framed as choices:
 *
 *   - Spymaster: choice over a candidate clue vocabulary, then a score for
 *     how many words the clue should link.
 *   - Operative: choice over the unrevealed board words (plus PASS).
 *
 * API: POST https://api.typesafe.ai/v1/systemone  (docs.typesafe.ai)
 */

const JEV_MODEL = "jev-latest";
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};

type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

type JevQuestion = ChoiceQuestion | ScoreQuestion;

type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

type JevScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  confidence: number;
};

type JevResponse = {
  model: string;
  answers: Record<string, JevChoiceAnswer | JevScoreAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
};

/**
 * Common English words used as candidate clues for the Jev spymaster. Jev
 * cannot generate text, so it picks the best legal candidate from this list
 * (board words are filtered out at request time).
 */
export const CLUE_VOCABULARY = [
  "ANIMAL", "BATTLE", "BEAUTY", "BELL", "BODY", "BREAD", "BRIDGE", "BRIGHT", "BROKEN",
  "CANDLE", "CASTLE", "CHAIN", "CIRCLE", "CLOCK", "CLOUD", "COIN", "COLD", "COLOR",
  "COMMAND", "CROWN", "DANCE", "DARK", "DEEP", "DIAMOND", "DOOR", "DREAM", "DRIVE",
  "DRUM", "EARTH", "ECHO", "EDGE", "EMPIRE", "ENGINE", "FALL", "FARM",
  "FEATHER", "FIRE", "FISH", "FLIGHT", "FLOW", "FOREST", "FORTUNE", "FRAME", "FROST",
  "GARDEN", "GIANT", "GLASS", "GOLD", "GRACE", "GRAIN", "GRAND", "GREEN", "GUARD",
  "HAMMER", "HAND", "HARMONY", "HAWK", "HEART", "HEAVEN", "HILL", "HORN", "HORSE",
  "HUNTER", "ICE", "IRIS", "IRON", "IVORY", "JADE", "JET", "JOINT", "JOURNEY", "JUNGLE",
  "KEY", "KING", "KITE", "KNIGHT", "LADDER", "LAMP", "LAUNCH", "LEAF", "LEVEL", "LIGHT",
  "LILY", "LION", "LOCK", "MAGIC", "MARCH", "MASK", "MASTER", "MELON", "MERCHANT",
  "MIRROR", "MOON", "MOUNTAIN", "MUSIC", "NEEDLE", "NERVE", "NOBLE", "NORTH", "OCEAN",
  "ORANGE", "PALACE", "PAPER", "PATH", "PEARL", "PILOT", "PIVOT", "PLANE", "PLANT",
  "PLAY", "POINT", "POUND", "PRISM", "PULSE", "RAIN", "RANCH", "RAPID", "RAVEN", "REACH",
  "RIDGE", "RING", "RIVER", "ROAD", "ROSE", "RULER", "RUN", "SCALE", "SCARF", "SEAL",
  "SHADOW", "SHIP", "SHORE", "SILVER", "SKY", "SMOKE", "SNOW", "SOUL", "SOUND", "SPARK",
  "SPHERE", "SPIKE", "SPINE", "SPIRAL", "STAR", "STEEL", "STONE", "STORM", "SUN", "SWORD",
  "TABLE", "TAIL", "TEMPLE", "TENT", "THREAD", "THUNDER", "TIGER", "TOWER", "TRACE",
  "TRAIN", "TRAP", "TREE", "TRIAL", "TRUNK", "TUNNEL", "VALLEY", "VELVET", "VINE",
  "WALK", "WALL", "WAVE", "WHEEL", "WIND", "WOLF", "WOOD", "WORLD", "ZONE",
];

export type JevAnswers = Record<string, JevChoiceAnswer | JevScoreAnswer>;

/** Evaluate a question map against a state in a single TypeSafe API call. */
export async function askJev(
  state: string,
  questions: Record<string, JevQuestion>,
): Promise<JevAnswers> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, model: JEV_MODEL, questions }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`TypeSafe API returned ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as JevResponse;
    return data.answers ?? {};
  } finally {
    clearTimeout(timeoutId);
  }
}

/** The clue candidates Jev may pick from, excluding anything on the board. */
export function candidateClues(boardWords: string[]): string[] {
  const board = new Set(boardWords.map((w) => w.toUpperCase()));
  return CLUE_VOCABULARY.filter((w) => !board.has(w));
}
