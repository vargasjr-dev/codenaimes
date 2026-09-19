"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Trophy, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type HistoryGame = {
  id: string;
  name: string;
  status: string;
  winner: string | null;
  myTeam: 'red' | 'blue' | null;
  result: 'win' | 'loss' | null;
  score: { red: number; blue: number };
  finishedAt: string | null;
};

export function GameHistory() {
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const router = useRouter();
  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/games/history');
      if (!res.ok) return;
      const data = await res.json();
      setGames(data.games ?? []);
      setPage((p) => Math.min(p, Math.max(0, Math.ceil((data.games ?? []).length / PAGE_SIZE) - 1)));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No games yet. Start one and it will show up here!</p>
        </CardContent>
      </Card>
    );
  }

  const wins = games.filter(g => g.result === 'win').length;
  const losses = games.filter(g => g.result === 'loss').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <span className="flex items-center gap-1"><Trophy className="h-4 w-4 text-emerald-500" /> {wins} wins</span>
        <span className="flex items-center gap-1"><XCircle className="h-4 w-4 text-muted-foreground" /> {losses} losses</span>
      </div>
      {games.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(game => (
        <Card
          key={game.id}
          className="transition-all hover:scale-[1.01] cursor-pointer"
          onClick={() => router.push(`/game/${game.id}`)}
        >
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {game.result === 'win' && <Trophy className="h-4 w-4 shrink-0 text-emerald-500" />}
              {game.result === 'loss' && <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />}
              {game.result === null && <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="font-medium truncate">
                {game.finishedAt
                  ? new Date(game.finishedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {game.score && (game.score.red > 0 || game.score.blue > 0) && (
                <span className="text-sm font-mono text-muted-foreground" title="Red – Blue words revealed">
                  <span className="text-team-red font-bold">{game.score.red}</span>
                  {' – '}
                  <span className="text-team-blue font-bold">{game.score.blue}</span>
                </span>
              )}
              {game.result && (
                <Badge
                  variant="outline"
                  className={cn(
                    game.result === 'win' ? 'text-emerald-500 border-emerald-500/50' : 'text-muted-foreground'
                  )}
                >
                  {game.result === 'win' ? 'Win' : 'Loss'}
                </Badge>
              )}
              {game.result === null && (
                <Badge variant="secondary">{game.status === 'waiting' ? 'Waiting' : 'In Progress'}</Badge>
              )}
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); router.push(`/game/${game.id}`); }}>
                Open
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {games.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Newer
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(games.length / PAGE_SIZE)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(games.length / PAGE_SIZE) - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
