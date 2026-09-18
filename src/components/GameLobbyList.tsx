"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';

type LobbyGame = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

export function GameLobbyList() {
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchGames();
    // Poll for updates in place of Supabase realtime channels
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/games');
      if (!res.ok) {
        console.error('Error fetching games');
        return;
      }
      const data = await res.json();
      setGames(data.games ?? []);
      setPlayerCounts(data.playerCounts ?? {});
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/4 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No games yet. Create one to get started!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {games.map(game => (
        <Card key={game.id} className="card-glow transition-all hover:scale-[1.01]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">{game.name}</CardTitle>
              <Badge variant={game.status === 'waiting' ? 'secondary' : 'default'}>
                {game.status === 'waiting' ? 'Lobby' : 'In Progress'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {playerCounts[game.id] ?? 0} agents
            </div>
            <Button size="sm" onClick={() => joinGame(game.id)} disabled={!user}>
              View Game
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
