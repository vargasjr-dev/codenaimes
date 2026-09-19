import { cn } from '@/lib/utils';
import { WordAssignment } from '@/lib/codenames-words';

interface GameBoardProps {
  words: string[];
  wordAssignments: Record<string, WordAssignment>;
  revealedWords: string[];
  isSpymaster: boolean;
  onWordClick?: (word: string) => void;
  disabled?: boolean;
}

export function GameBoard({
  words,
  wordAssignments,
  revealedWords,
  isSpymaster,
  onWordClick,
  disabled = false,
}: GameBoardProps) {
  const getWordClasses = (word: string) => {
    const isRevealed = revealedWords.includes(word);
    const assignment = wordAssignments[word];

    const baseClasses = "game-word-card";

    if (isRevealed) {
      switch (assignment) {
        case 'red':
          return cn(baseClasses, "revealed-red");
        case 'blue':
          return cn(baseClasses, "revealed-blue");
        case 'neutral':
          return cn(baseClasses, "revealed-neutral");
        case 'assassin':
          return cn(baseClasses, "revealed-assassin");
      }
    }

    // Spymaster view - show colors with opacity
    if (isSpymaster) {
      switch (assignment) {
        case 'red':
          return cn(baseClasses, "border-2 border-team-red bg-team-red/20");
        case 'blue':
          return cn(baseClasses, "border-2 border-team-blue bg-team-blue/20");
        case 'neutral':
          return cn(baseClasses, "border-2 border-neutral-card bg-neutral-card/20");
        case 'assassin':
          return cn(baseClasses, "border-2 border-foreground bg-assassin/30");
      }
    }

    return baseClasses;
  };

  return (
    <div className="grid grid-cols-5 gap-1 sm:gap-2 md:gap-3 p-1 sm:p-2 md:p-4">
      {words.map((word, index) => (
        <button
          key={`${word}-${index}`}
          className={cn(
            getWordClasses(word),
            disabled && "cursor-not-allowed opacity-75",
            !disabled && !revealedWords.includes(word) && "hover:border-primary"
          )}
          onClick={() => !disabled && !revealedWords.includes(word) && onWordClick?.(word)}
          disabled={disabled || revealedWords.includes(word)}
        >
          <span className="text-[11px] xs:text-sm sm:text-base md:text-lg font-semibold tracking-tight sm:tracking-wide uppercase break-words leading-tight">
            {word}
          </span>
        </button>
      ))}
    </div>
  );
}
