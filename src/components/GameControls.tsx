'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Zap, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FooterPlayer {
  id: string;
  team: string;
  role: string;
  username?: string;
  agentDisplayName?: string | null;
  isAgent?: boolean;
}

interface GameControlsProps {
  gameId: string;
  currentTeam: 'red' | 'blue' | null;
  currentPhase: string | null;
  players: FooterPlayer[];
  isHost: boolean;
  winner: string | null;
  /** The signed-in player's own seat (non-agent) */
  myPlayer?: { team: string; role: string; isAgent?: boolean } | null;
  onStateChange: () => void;
}

type GameEvent = {
  id: string;
  team: string | null;
  description: string;
  createdAt: string;
};

/** Hypersummarized footer: clue entry (human spymaster), Step (agent), history. */
export function GameControls({ gameId, currentTeam, currentPhase, players, winner, myPlayer, onStateChange }: GameControlsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [clueWord, setClueWord] = useState('');
  const [clueNumber, setClueNumber] = useState('2');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const { toast } = useToast();

  const isClueTime = currentPhase === 'spymaster_clue';
  const currentAgent = isClueTime
    ? null
    : players.find(p => p.team === currentTeam && p.role === 'operative' && p.isAgent);

  // Human spymaster of the current team enters the clue manually
  const amISPymaster =
    isClueTime &&
    !winner &&
    currentTeam != null &&
    myPlayer?.team === currentTeam &&
    myPlayer?.role === 'spymaster' &&
    !myPlayer?.isAgent;

  useEffect(() => {
    if (!isHistoryOpen) return;
    fetch(`/api/games/${gameId}/events`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }, [isHistoryOpen, lastAction, gameId]);

  const submitClue = async (e: React.FormEvent) => {
    e.preventDefault();
    const number = parseInt(clueNumber, 10);
    if (!clueWord.trim() || !Number.isInteger(number)) return;

    setIsProcessing(true);
    const res = await fetch(`/api/games/${gameId}/clue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: clueWord.trim(), number }),
    });
    const data = await res.json();
    setIsProcessing(false);

    if (!res.ok) {
      toast({ title: 'Invalid clue', description: data.error, variant: 'destructive' });
      return;
    }

    setClueWord('');
    onStateChange();
  };

  const stepAgent = async () => {
    const role = isClueTime ? 'spymaster' : 'operative';
    const currentPlayer = players.find(p => p.team === currentTeam && p.role === role);
    if (!currentPlayer) return;

    setIsProcessing(true);

    try {
      const action = isClueTime ? 'give_clue' : 'make_guess';
      const res = await fetch(`/api/games/${gameId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId: currentPlayer.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Agent Error', description: data.error, variant: 'destructive' });
      } else if (action === 'give_clue') {
        setLastAction(`${currentTeam?.toUpperCase()} spymaster gave clue: ${data.clue} (${data.number})`);
      } else if (data.action === 'pass') {
        setLastAction(`${currentTeam?.toUpperCase()} operative passed`);
      } else if (data.action === 'assassin') {
        setLastAction(`${currentTeam?.toUpperCase()} hit the assassin — ${data.winner?.toUpperCase()} wins!`);
      } else if (data.action === 'win') {
        setLastAction(`${currentTeam?.toUpperCase()} guessed "${data.guess}" — ${data.winner?.toUpperCase()} wins!`);
      } else if (data.action === 'correct') {
        setLastAction(`${currentTeam?.toUpperCase()} guessed "${data.guess}" ✓ (${data.guessesRemaining} left)`);
      } else {
        setLastAction(`${currentTeam?.toUpperCase()} guessed "${data.guess}" — turn ends`);
      }

      onStateChange();
    } catch (err) {
      console.error('Agent call failed:', err);
      toast({ title: 'Error', description: 'Failed to execute agent turn', variant: 'destructive' });
    }

    setIsProcessing(false);
  };

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
        <span className="text-muted-foreground truncate text-xs">
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
          <span className="text-muted-foreground truncate text-xs">
            {isClueTime ? 'Spymaster' : 'Operative'}
            {currentAgent ? ` — ${currentAgent.agentDisplayName || 'Jev'} AI` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <History className="h-3 w-3" />
                History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[70vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Move History</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                {events.length === 0 && (
                  <p className="text-sm text-muted-foreground">No moves yet.</p>
                )}
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 rounded-full shrink-0",
                        ev.team === 'red' ? "bg-team-red" : ev.team === 'blue' ? "bg-team-blue" : "bg-muted-foreground"
                      )}
                    />
                    <span className="text-muted-foreground">{ev.description}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {currentAgent && !winner && (
            <Button
              onClick={stepAgent}
              disabled={isProcessing}
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Step
            </Button>
          )}
        </div>
      </div>

      {amISPymaster && (
        <form onSubmit={submitClue} className="flex items-center gap-2 pt-1">
          <Input
            value={clueWord}
            onChange={(e) => setClueWord(e.target.value)}
            placeholder="Your clue word"
            className="h-8 text-sm flex-1"
            autoComplete="off"
          />
          <Input
            value={clueNumber}
            onChange={(e) => setClueNumber(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="h-8 text-sm w-14 text-center"
            aria-label="Number of words"
          />
          <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={isProcessing || !clueWord.trim()}>
            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Give Clue'}
          </Button>
        </form>
      )}

      {lastAction && (
        <p className="text-[11px] text-muted-foreground truncate">{lastAction}</p>
      )}
    </div>
  );
}
