import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GameBoard } from '@/components/GameBoard';
import { TeamPanel } from '@/components/TeamPanel';
import { JoinGamePanel } from '@/components/JoinGamePanel';
import { ClueDisplay } from '@/components/ClueDisplay';
import { GameControls } from '@/components/GameControls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Loader2, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRandomWords, generateWordAssignments, WordAssignment } from '@/lib/codenames-words';
import { cn } from '@/lib/utils';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    fetchGameData();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, () => fetchGameData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, () => fetchGameData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const fetchGameData = async () => {
    const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle();
    const { data: playersData } = await supabase.from('game_players').select('*, profiles(username)').eq('game_id', gameId);
    setGame(gameData);
    setPlayers(playersData || []);
    setLoading(false);
  };

  const startGame = async () => {
    // Validate we have 2 players per team
    const redPlayers = players.filter(p => p.team === 'red');
    const bluePlayers = players.filter(p => p.team === 'blue');

    if (redPlayers.length < 2 || bluePlayers.length < 2) {
      toast({ 
        title: 'Missing players', 
        description: 'Need 2 players on each team (4 total)', 
        variant: 'destructive' 
      });
      return;
    }

    setIsStarting(true);

    // Auto-assign roles: first player on each team becomes spymaster, second becomes operative
    const roleAssignments = [
      { id: redPlayers[0].id, role: 'spymaster' },
      { id: redPlayers[1].id, role: 'operative' },
      { id: bluePlayers[0].id, role: 'spymaster' },
      { id: bluePlayers[1].id, role: 'operative' },
    ];

    // Update player roles
    for (const assignment of roleAssignments) {
      await supabase.from('game_players')
        .update({ role: assignment.role })
        .eq('id', assignment.id);
    }

    const words = getRandomWords(25);
    const startingTeam = Math.random() > 0.5 ? 'red' : 'blue';
    const assignments = generateWordAssignments(words, startingTeam);

    await supabase.from('games').update({
      status: 'in_progress',
      words,
      word_assignments: assignments,
      revealed_words: [],
      current_team: startingTeam,
      current_phase: 'spymaster_clue',
    }).eq('id', gameId);

    toast({
      title: 'Roles assigned!',
      description: 'First player on each team is Spymaster, second is Operative.',
    });

    setIsStarting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!game) return <div className="min-h-screen flex items-center justify-center"><p>Game not found</p></div>;

  const myPlayer = players.find(p => p.user_id === user?.id);
  const isHost = game.host_user_id === user?.id;
  const redPlayers = players.filter(p => p.team === 'red');
  const bluePlayers = players.filter(p => p.team === 'blue');
  const words = (game.words as string[]) || [];
  const wordAssignments = (game.word_assignments as Record<string, WordAssignment>) || {};
  const revealedWords = (game.revealed_words as string[]) || [];
  const redRemaining = words.filter(w => wordAssignments[w] === 'red' && !revealedWords.includes(w)).length;
  const blueRemaining = words.filter(w => wordAssignments[w] === 'blue' && !revealedWords.includes(w)).length;

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="font-display text-xl font-bold">{game.name}</h1>
            <Badge variant={game.status === 'waiting' ? 'secondary' : game.status === 'finished' ? 'outline' : 'default'}>
              {game.status === 'finished' && <Trophy className="h-3 w-3 mr-1" />}
              {game.status}
            </Badge>
          </div>
          {isHost && game.status === 'waiting' && (
            <Button onClick={startGame} disabled={isStarting || players.length < 4}>
              {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start Game
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <TeamPanel team="red" players={redPlayers} remainingWords={redRemaining} isCurrentTeam={game.current_team === 'red'} />
            <TeamPanel team="blue" players={bluePlayers} remainingWords={blueRemaining} isCurrentTeam={game.current_team === 'blue'} />
            {!myPlayer && game.status === 'waiting' && <JoinGamePanel gameId={gameId!} existingPlayers={players} onJoined={fetchGameData} />}
            {game.status === 'in_progress' && (
              <GameControls 
                gameId={gameId!} 
                currentTeam={game.current_team} 
                currentPhase={game.current_phase} 
                players={players} 
                isHost={isHost}
                winner={game.winner}
              />
            )}
          </div>
          <div className="lg:col-span-3 space-y-4">
            {(game.status === 'in_progress' || game.status === 'finished') && (
              <>
                <ClueDisplay clue={game.current_clue} number={game.current_clue_number} currentTeam={game.current_team} guessesRemaining={game.guesses_remaining} />
                <GameBoard words={words} wordAssignments={wordAssignments} revealedWords={revealedWords} isSpymaster={myPlayer?.role === 'spymaster'} disabled={true} />
              </>
            )}
            {game.status === 'waiting' && (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">Waiting for players to join...</p>
                  <p className="text-sm text-muted-foreground">
                    {players.length}/4 players 
                    {players.length >= 4 && isHost && ' - Ready to start!'}
                  </p>
                </div>
              </div>
            )}
            {game.status === 'finished' && game.winner && (
              <div className={cn(
                "text-center py-8 rounded-lg border-2",
                game.winner === 'red' ? "border-team-red bg-team-red/10" : "border-team-blue bg-team-blue/10"
              )}>
                <Trophy className={cn(
                  "h-12 w-12 mx-auto mb-4",
                  game.winner === 'red' ? "text-team-red" : "text-team-blue"
                )} />
                <h2 className={cn(
                  "text-3xl font-display font-bold",
                  game.winner === 'red' ? "text-team-red" : "text-team-blue"
                )}>
                  {game.winner.toUpperCase()} TEAM WINS!
                </h2>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
