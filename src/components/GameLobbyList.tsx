import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Game {
  id: string;
  name: string;
  status: string;
  created_at: string;
  host_user_id: string;
}

interface GamePlayer {
  game_id: string;
  team: string;
  role: string;
}

export function GameLobbyList() {
  const [games, setGames] = useState<Game[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchGames();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('games-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => {
          fetchGames();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGames = async () => {
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: false });

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return;
    }

    setGames(gamesData || []);

    // Fetch player counts for each game
    if (gamesData && gamesData.length > 0) {
      const gameIds = gamesData.map(g => g.id);
      const { data: playersData } = await supabase
        .from('game_players')
        .select('game_id')
        .in('game_id', gameIds);

      if (playersData) {
        const counts: Record<string, number> = {};
        playersData.forEach(p => {
          counts[p.game_id] = (counts[p.game_id] || 0) + 1;
        });
        setPlayerCounts(counts);
      }
    }

    setLoading(false);
  };

  const joinGame = async (gameId: string) => {
    navigate(`/game/${gameId}`);
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
      <Card className="border-dashed border-2 border-border">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">No active games found</p>
          <p className="text-sm text-muted-foreground">
            Create a new game to start competing!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {games.map(game => (
        <Card 
          key={game.id} 
          className="hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => joinGame(game.id)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display">{game.name}</CardTitle>
              <Badge variant={game.status === 'waiting' ? 'secondary' : 'default'}>
                {game.status === 'waiting' ? (
                  <><Clock className="h-3 w-3 mr-1" /> Waiting</>
                ) : (
                  <><Play className="h-3 w-3 mr-1" /> In Progress</>
                )}
              </Badge>
            </div>
            <CardDescription className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {playerCounts[game.id] || 0}/4 players
              </span>
              <span>
                Created {new Date(game.created_at).toLocaleDateString()}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                joinGame(game.id);
              }}
            >
              {game.host_user_id === user?.id ? 'View Game' : 'Join Game'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
