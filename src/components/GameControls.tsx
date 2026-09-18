"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Zap, Play, Pause } from 'lucide-react';
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
    agentDisplayName?: string | null;
    isAgent?: boolean;
  }>;
  isHost: boolean;
  winner: string | null;
  onStateChange: () => void;
}

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
        // Update last action display
        if (action === 'give_clue') {
          setLastAction(`${currentTeam?.toUpperCase()} Spymaster gave clue: ${data.clue} (${data.number})`);
        } else {
          if (data.action === 'pass') {
            setLastAction(`${currentTeam?.toUpperCase()} Operative passed`);
          } else if (data.action === 'assassin') {
            setLastAction(`${currentTeam?.toUpperCase()} Operative hit ASSASSIN! ${data.winner?.toUpperCase()} wins!`);
            setAutoPlay(false);
          } else if (data.action === 'win') {
            setLastAction(`${currentTeam?.toUpperCase()} Operative guessed "${data.guess}" - ${data.winner?.toUpperCase()} WINS!`);
            setAutoPlay(false);
          } else if (data.action === 'correct') {
            setLastAction(`${currentTeam?.toUpperCase()} Operative guessed "${data.guess}" ✓ (${data.guessesRemaining} left)`);
          } else {
            setLastAction(`${currentTeam?.toUpperCase()} Operative guessed "${data.guess}" - Turn ends`);
          }
        }

        toast({ title: 'Turn Complete', description: `Agent action: ${data.action || 'clue given'}` });
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

  if (winner) {
    return (
      <Card className={cn(
        "border-2",
        winner === 'red' ? "border-team-red card-glow-red" : "border-team-blue card-glow-blue"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Game Over
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn(
            "text-2xl font-display font-bold text-center",
            winner === 'red' ? "text-team-red" : "text-team-blue"
          )}>
            {winner.toUpperCase()} TEAM WINS!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          Agent Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Current Turn</p>
            <div className="flex items-center gap-2">
              <Badge variant={currentTeam === 'red' ? 'destructive' : 'default'} className={cn(
                currentTeam === 'red' ? "bg-team-red" : "bg-team-blue"
              )}>
                {currentTeam?.toUpperCase()}
              </Badge>
              <span className="text-sm font-medium">
                {currentPhase === 'spymaster_clue' ? 'Spymaster' : 'Operative'}
              </span>
            </div>
          </div>
          {currentPlayer && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Agent</p>
              <p className="text-sm font-medium truncate max-w-32">
                {currentPlayer.agentDisplayName || 'Jev'}
              </p>
            </div>
          )}
        </div>

        {lastAction && (
          <div className="p-2 rounded bg-muted/50 text-sm">
            <p className="text-muted-foreground text-xs mb-1">Last Action</p>
            <p className="font-medium">{lastAction}</p>
          </div>
        )}

        {isHost && (
          <div className="flex gap-2">
            <Button
              onClick={executeAgentTurn}
              disabled={isProcessing || autoPlay}
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Step
            </Button>
            {autoPlay ? (
              <Button onClick={() => setAutoPlay(false)} variant="destructive" className="flex-1">
                <Pause className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={() => setAutoPlay(true)} disabled={isProcessing} variant="outline" className="flex-1">
                <Play className="mr-2 h-4 w-4" />
                Auto
              </Button>
            )}
          </div>
        )}

        {!isHost && (
          <p className="text-sm text-muted-foreground text-center">
            Only the host can control the game
          </p>
        )}
      </CardContent>
    </Card>
  );
}
