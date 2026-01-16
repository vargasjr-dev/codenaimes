// Standard Codenames word list
export const CODENAMES_WORDS = [
  "AFRICA", "AGENT", "AIR", "ALIEN", "ALPS", "AMAZON", "AMBULANCE", "AMERICA",
  "ANGEL", "ANTARCTICA", "APPLE", "ARM", "ATLANTIS", "AUSTRALIA", "AZTEC",
  "BACK", "BALL", "BAND", "BANK", "BAR", "BARK", "BAT", "BATTERY", "BEACH",
  "BEAR", "BEAT", "BED", "BEIJING", "BELL", "BELT", "BERLIN", "BERMUDA",
  "BERRY", "BILL", "BLOCK", "BOARD", "BOLT", "BOMB", "BOND", "BOOM", "BOOT",
  "BOTTLE", "BOW", "BOX", "BRIDGE", "BRUSH", "BUCK", "BUFFALO", "BUG",
  "BUGLE", "BUTTON", "CALF", "CANADA", "CAP", "CAPITAL", "CAR", "CARD",
  "CARROT", "CASINO", "CAST", "CAT", "CELL", "CENTAUR", "CENTER", "CHAIR",
  "CHANGE", "CHARGE", "CHECK", "CHEST", "CHICK", "CHINA", "CHOCOLATE",
  "CHURCH", "CIRCLE", "CLIFF", "CLOAK", "CLUB", "CODE", "COLD", "COMIC",
  "COMPOUND", "CONCERT", "CONDUCTOR", "CONTRACT", "COOK", "COPPER", "COTTON",
  "COURT", "COVER", "CRANE", "CRASH", "CRICKET", "CROSS", "CROWN", "CYCLE",
  "CZECH", "DANCE", "DATE", "DAY", "DEATH", "DECK", "DEGREE", "DIAMOND",
  "DICE", "DINOSAUR", "DISEASE", "DOCTOR", "DOG", "DRAFT", "DRAGON", "DRESS",
  "DRILL", "DROP", "DUCK", "DWARF", "EAGLE", "EGYPT", "EMBASSY", "ENGINE",
  "ENGLAND", "EUROPE", "EYE", "FACE", "FAIR", "FALL", "FAN", "FENCE", "FIELD",
  "FIGHTER", "FIGURE", "FILE", "FILM", "FIRE", "FISH", "FLUTE", "FLY",
  "FOOT", "FORCE", "FOREST", "FORK", "FRANCE", "GAME", "GAS", "GENIUS",
  "GERMANY", "GHOST", "GIANT", "GLASS", "GLOVE", "GOLD", "GRACE", "GRASS",
  "GREECE", "GREEN", "GROUND", "HAM", "HAND", "HAWK", "HEAD", "HEART",
  "HELICOPTER", "HIMALAYAS", "HOLE", "HOLLYWOOD", "HONEY", "HOOD", "HOOK",
  "HORN", "HORSE", "HORSESHOE", "HOSPITAL", "HOTEL", "ICE", "ICE CREAM",
  "INDIA", "IRON", "IVORY", "JACK", "JAM", "JET", "JUPITER", "KANGAROO",
  "KETCHUP", "KEY", "KID", "KING", "KIWI", "KNIFE", "KNIGHT", "LAB", "LAP",
  "LASER", "LAWYER", "LEAD", "LEMON", "LEPRECHAUN", "LIFE", "LIGHT", "LIMOUSINE",
  "LINE", "LINK", "LION", "LITTER", "LOCH NESS", "LOCK", "LOG", "LONDON",
  "LUCK", "MAIL", "MAMMOTH", "MAPLE", "MARBLE", "MARCH", "MASS", "MATCH",
  "MERCURY", "MEXICO", "MICROSCOPE", "MILLIONAIRE", "MINE", "MINT", "MISSILE",
  "MODEL", "MOLE", "MOON", "MOSCOW", "MOUNT", "MOUSE", "MOUTH", "MUG",
  "NAIL", "NEEDLE", "NET", "NEW YORK", "NIGHT", "NINJA", "NOTE", "NOVEL",
  "NURSE", "NUT", "OCTOPUS", "OIL", "OLIVE", "OLYMPUS", "OPERA", "ORANGE",
  "ORGAN", "PALM", "PAN", "PANDA", "PAPER", "PARACHUTE", "PARK", "PART",
  "PASS", "PASTE", "PENGUIN", "PHOENIX", "PIANO", "PIE", "PILOT", "PIN",
  "PIPE", "PIRATE", "PISTOL", "PIT", "PITCH", "PLANE", "PLASTIC", "PLATE",
  "PLATYPUS", "PLAY", "PLOT", "POINT", "POISON", "POLE", "POLICE", "POOL",
  "PORT", "POST", "POUND", "PRESS", "PRINCE", "PRINCESS", "PRISON", "PURPLE",
  "QUEEN", "RABBIT", "RACKET", "RAY", "REVOLUTION", "RING", "ROBIN", "ROBOT",
  "ROCK", "ROME", "ROOT", "ROSE", "ROULETTE", "ROUND", "ROW", "RULER",
  "SATELLITE", "SATURN", "SCALE", "SCHOOL", "SCIENTIST", "SCORPION", "SCREEN",
  "SCUBA DIVER", "SEAL", "SERVER", "SHADOW", "SHAKESPEARE", "SHARK", "SHIP",
  "SHOE", "SHOP", "SHOT", "SHOWER", "SINK", "SKYSCRAPER", "SLIP", "SLUG",
  "SMUGGLER", "SNOW", "SNOWMAN", "SOCK", "SOLDIER", "SOUL", "SOUND", "SPACE",
  "SPELL", "SPIDER", "SPIKE", "SPINE", "SPOT", "SPRING", "SPY", "SQUARE",
  "STADIUM", "STAFF", "STAR", "STATE", "STICK", "STOCK", "STRAW", "STREAM",
  "STRIKE", "STRING", "SUB", "SUIT", "SUPERHERO", "SWING", "SWITCH", "TABLE",
  "TABLET", "TAG", "TAIL", "TAP", "TEACHER", "TELESCOPE", "TEMPLE", "THIEF",
  "THUMB", "TICK", "TIE", "TIME", "TOKYO", "TOOTH", "TORCH", "TOWER", "TRACK",
  "TRAIN", "TRIANGLE", "TRIP", "TRUNK", "TUBE", "TURKEY", "UNDERTAKER",
  "UNICORN", "VACUUM", "VAN", "VET", "WAKE", "WALL", "WAR", "WASHER",
  "WASHINGTON", "WATCH", "WATER", "WAVE", "WEB", "WELL", "WHALE", "WHIP",
  "WIND", "WITCH", "WORM", "YARD"
];

export function getRandomWords(count: number = 25): string[] {
  const shuffled = [...CODENAMES_WORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export type WordAssignment = 'red' | 'blue' | 'neutral' | 'assassin';

export interface WordAssignments {
  [word: string]: WordAssignment;
}

export function generateWordAssignments(words: string[], startingTeam: 'red' | 'blue'): WordAssignments {
  const assignments: WordAssignments = {};
  const shuffledIndices = [...Array(25).keys()].sort(() => Math.random() - 0.5);
  
  // Starting team gets 9, other team gets 8, 7 neutral, 1 assassin
  const startingTeamCount = 9;
  const otherTeamCount = 8;
  const neutralCount = 7;
  
  let index = 0;
  
  // Assign starting team words
  for (let i = 0; i < startingTeamCount; i++) {
    assignments[words[shuffledIndices[index++]]] = startingTeam;
  }
  
  // Assign other team words
  const otherTeam = startingTeam === 'red' ? 'blue' : 'red';
  for (let i = 0; i < otherTeamCount; i++) {
    assignments[words[shuffledIndices[index++]]] = otherTeam;
  }
  
  // Assign neutral words
  for (let i = 0; i < neutralCount; i++) {
    assignments[words[shuffledIndices[index++]]] = 'neutral';
  }
  
  // Assign assassin
  assignments[words[shuffledIndices[index]]] = 'assassin';
  
  return assignments;
}
