'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GameControlsProps {
  gameId: string;
  currentTeam: 'red' | 'blue' | null;
  currentPhase: string | null;
  players: Array<{
    id: string;
    team: string;
    role: string;
    username?: string;
    agentDisplayName?: string | null;
    isAgent?: boolean;
  }>;
  isHost: boolean;
  winner: string | null;
  onStateChange: () => void;
}

/** Hypersummarized footer: team rosters, turn indicator, and agent controls. */
export function GameControls({ gameId, currentTeam, currentPhase, players, isHost, winner, onStateChange }: GameControlsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const { toast } = useToast();

  const getCurrentPlayer = () => {
    if (!currentTeam || !currentPhase) return null;
    const role = currentPhase === 'spymaster_clue' ? 'spymaster' : 'operative';
    return players.find(p => p.team === currentTeam && p.role === role);
  };

  const executeAgentTurn = async () => {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) {
      toast({ title: 'No player found', description: 'Cannot find player for current turn', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setAutoPlay(true);

    try {
      const action = currentPhase === 'spymaster_clue' ? 'give_clue' : 'make_guess';

      const res = await fetch(`/api/games/${gameId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId: currentPlayer.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error('Agent error:', data.error);
        toast({ title: 'Agent Error', description: data.error, variant: 'destructive' });
        setAutoPlay(false);
      } else {
        if (action === 'give_clue') {
          setLastAction(`${currentTeam?.toUpperCase()} spymaster gave clue: ${data.clue} (${data.number})`);
        } else if (data.action === 'pass') {
          setLastAction(`${currentTeam?.toUpperCase()} operative passed`);
        } else if (data.action === 'assassin') {
          setLastAction(`${currentTeam?.toUpperCase()} hit the assassin — ${data.winner?.toUpperCase()} wins!`);
          setAutoPlay(false);
        } else if (data.action === 'win') {
          setLastAction(`${currentTeam?.toUpperCase()} guessed "${data.guess}" — ${data.winner?.toUpperCase()} wins!`);
          setAutoPlay(false);
        } else if (data.action === 'correct') {
          setLastAction(`${currentTeam?.toUpperCase()} guessed "${data.guess}" ✓ (${data.guessesRemaining} left)`);
        } else {
          setLastAction(`${currentTeam?.toUpperCase()} guessed "${data.guess}" — turn ends`);
        }

        onStateChange();
      }
    } catch (err) {
      console.error('Agent call failed:', err);
      toast({ title: 'Error', description: 'Failed to execute agent turn', variant: 'destructive' });
      setAutoPlay(false);
    }

    setIsProcessing(false);
  };

  // Auto-play loop: re-render driven, waits for the previous turn to settle
  if (autoPlay && !isProcessing && !winner) {
    setTimeout(() => {
      if (autoPlay && !isProcessing && !winner) {
        executeAgentTurn();
      }
    }, 2000);
  }

  const currentPlayer = getCurrentPlayer();

  const teamSummary = (team: 'red' | 'blue') => {
    const teamPlayers = players.filter(p => p.team === team);
    const names = teamPlayers.map(p =>
      p.isAgent ? `${p.agentDisplayName || 'Jev'} AI` : p.username || '?'
    );
    return (
      <div key={team} className="flex items-center gap-1.5 min-w-0">
        <span className={cn(
          "font-bold uppercase shrink-0",
          team === 'red' ? "text-team-red" : "text-team-blue"
        )}>
          {team}
        </span>
        <span className="text-muted-foreground truncate">
          {names.join(', ') || '—'}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 space-y-1.5">
      <div className="grid grid-cols-2 gap-2 text-xs">
        {teamSummary('red')}
        {teamSummary('blue')}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 shrink-0",
              currentTeam === 'red' ? "border-team-red text-team-red" : "border-team-blue text-team-blue"
            )}
          >
            {currentTeam?.toUpperCase()}
          </Badge>
          <span className="text-muted-foreground truncate">
            {currentPhase === 'spymaster_clue' ? 'Spymaster' : 'Operative'}
            {currentPlayer?.isAgent ? ` — ${currentPlayer.agentDisplayName || 'Jev'} AI` : ''}
          </span>
        </div>

        {isHost && !winner && (
          <div className="flex gap-1.5 shrink-0">
            <Button
              onClick={executeAgentTurn}
              disabled={isProcessing || autoPlay}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Step
            </Button>
            {autoPlay ? (
              <Button onClick={() => setAutoPlay(false)} variant="destructive" size="sm" className="h-7 px-2 text-xs">
                <Pause className="h-3 w-3" />
                Stop
              </Button>
            ) : (
              <Button onClick={() => setAutoPlay(true)} disabled={isProcessing} variant="outline" size="sm" className="h-7 px-2 text-xs">
                <Play className="h-3 w-3" />
                Auto
              </Button>
            )}
          </div>
        )}
      </div>

      {lastAction && (
        <p className="text-[11px] text-muted-foreground truncate">{lastAction}</p>
      )}
    </div>
  );
}
