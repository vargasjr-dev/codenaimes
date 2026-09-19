'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, History, Crown, Bot, User } from 'lucide-react';
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
  /** Game row's updatedAt — changes on every mutation, drives the events refetch */
  updatedAt?: string | null;
  /** The signed-in player's own seat (non-agent) */
  myPlayer?: { team: string; role: string; isAgent?: boolean } | null;
  /** Max clue number — the current team's unrevealed word count */
  maxClueNumber: number;
  onStateChange: () => void;
}

type GameEvent = {
  id: string;
  team: string | null;
  description: string;
  createdAt: string;
  round: number;
};

/** Hypersummarized footer: clue entry (human spymaster), Step (agent), history. */
export function GameControls({ gameId, currentTeam, currentPhase, players, winner, updatedAt, myPlayer, maxClueNumber, onStateChange }: GameControlsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestEvent, setLatestEvent] = useState<string | null>(null);
  const [clueWord, setClueWord] = useState('');
  const [clueNumber, setClueNumber] = useState('2');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [round, setRound] = useState(0);
  const { toast } = useToast();

  const isClueTime = currentPhase === 'spymaster_clue';
  // Current seat for either phase — Step shows whenever an agent is up
  const currentPlayer = isClueTime
    ? players.find(p => p.team === currentTeam && p.role === 'spymaster')
    : players.find(p => p.team === currentTeam && p.role === 'operative');
  const currentAgent = currentPlayer?.isAgent ? currentPlayer : null;

  // Human spymaster of the current team enters the clue manually
  const amISPymaster =
    isClueTime &&
    !winner &&
    currentTeam != null &&
    myPlayer?.team === currentTeam &&
    myPlayer?.role === 'spymaster' &&
    !myPlayer?.isAgent;

  const clueNumberOptions = Array.from({ length: Math.max(maxClueNumber, 1) }, (_, i) => i + 1);

  // Keep the selected clue number valid when the remaining-word max shrinks
  useEffect(() => {
    const n = parseInt(clueNumber, 10);
    if (!Number.isInteger(n) || n < 1 || n > maxClueNumber) {
      setClueNumber(String(Math.min(Math.max(Number.isInteger(n) ? n : 2, 1), maxClueNumber)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxClueNumber]);

  useEffect(() => {
    fetch(`/api/games/${gameId}/events`)
      .then((res) => res.json())
      .then((data) => {
        const evs: GameEvent[] = data.events ?? [];
        setEvents(evs);
        setRound(data.round ?? 0);
        setLatestEvent(evs.length ? evs[evs.length - 1].description : null);
      })
      .catch(() => setEvents([]));
  }, [gameId, updatedAt]);

  const submitClue = async (e: React.FormEvent) => {
    e.preventDefault();
    const number = parseInt(clueNumber, 10);
    if (!clueWord.trim() || !Number.isInteger(number)) return;
    if (number < 1 || number > maxClueNumber) {
      toast({ title: 'Invalid clue', description: `Number must be between 1 and ${maxClueNumber}`, variant: 'destructive' });
      return;
    }

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
                Round {round + 1}
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
                {events.map((ev) => {
                  const isSpymaster = /gave clue/.test(ev.description);
                  const Icon = isSpymaster ? Crown : /AI/.test(ev.description) ? Bot : User;
                  return (
                    <div key={ev.id} className="flex items-start gap-2 text-sm">
                      <Icon className={cn(
                        "h-3.5 w-3.5 mt-0.5 shrink-0",
                        ev.team === 'red' ? "text-team-red" : ev.team === 'blue' ? "text-team-blue" : "text-muted-foreground"
                      )} />
                      <span className="font-medium shrink-0">R{ev.round}</span>
                      <span className="text-muted-foreground">{ev.description}</span>
                    </div>
                  );
                })}
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
          <Select
            value={clueNumber}
            onValueChange={(v) => setClueNumber(v)}
          >
            <SelectTrigger className="h-8 w-16 text-sm" aria-label="Number of words">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clueNumberOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={isProcessing || !clueWord.trim()}>
            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Give Clue'}
          </Button>
        </form>
      )}

      {latestEvent && (
        <p className="text-[11px] text-muted-foreground truncate">{latestEvent}</p>
      )}
    </div>
  );
}
