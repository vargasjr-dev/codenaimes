import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ClueDisplayProps {
  clue: string | null;
  number: number | null;
  currentTeam: 'red' | 'blue' | null;
  guessesRemaining: number | null;
}

export function ClueDisplay({ clue, number, currentTeam, guessesRemaining }: ClueDisplayProps) {
  if (!clue) {
    return (
      <Card className={cn(
        "border-2 bg-muted/30",
        currentTeam === 'red' ? "border-team-red/60" : "border-team-blue/60"
      )}>
        <CardContent className="py-3 text-center">
          <p className={cn(
            "text-sm font-medium",
            currentTeam === 'red' ? "text-team-red" : "text-team-blue"
          )}>
            {currentTeam ? `${currentTeam.toUpperCase()} spymaster is thinking...` : "Waiting for clue..."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-2",
      currentTeam === 'red' ? "border-team-red card-glow-red" : "border-team-blue card-glow-blue"
    )}>
      <CardContent className="py-4">
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Current Clue</p>
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-2xl font-display font-bold uppercase",
                currentTeam === 'red' ? "text-team-red" : "text-team-blue"
              )}>
                {clue}
              </span>
              <Badge variant="outline" className="text-lg font-bold">
                {number}
              </Badge>
            </div>
          </div>
          {guessesRemaining !== null && (
            <div className="text-center border-l border-border pl-4">
              <p className="text-sm text-muted-foreground mb-1">Guesses Left</p>
              <span className="text-2xl font-bold">{guessesRemaining}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
