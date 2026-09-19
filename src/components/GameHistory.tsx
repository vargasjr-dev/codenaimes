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
  finishedAt: string | null;
};

export function GameHistory() {
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
        <span className="flex items-center gap-1"><Trophy className="h-4 w-4 text-team-red" /> {wins} wins</span>
        <span className="flex items-center gap-1"><XCircle className="h-4 w-4 text-muted-foreground" /> {losses} losses</span>
      </div>
      {games.map(game => (
        <Card
          key={game.id}
          className="transition-all hover:scale-[1.01] cursor-pointer"
          onClick={() => router.push(`/game/${game.id}`)}
        >
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {game.result === 'win' && <Trophy className="h-4 w-4 shrink-0 text-team-red" />}
              {game.result === 'loss' && <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />}
              {game.result === null && <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="font-medium truncate">{game.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
