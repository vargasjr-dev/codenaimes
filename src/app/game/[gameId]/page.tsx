"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { GameBoard } from "@/components/GameBoard";
import { TeamPanel } from "@/components/TeamPanel";
import { JoinGamePanel } from "@/components/JoinGamePanel";
import { ClueDisplay } from "@/components/ClueDisplay";
import { GameControls } from "@/components/GameControls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Loader2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WordAssignment } from "@/lib/codenames-words";
import { cn } from "@/lib/utils";

type GameRecord = {
  id: string;
  name: string;
  hostUserId: string;
  status: string;
  currentTeam: 'red' | 'blue' | null;
  currentPhase: string | null;
  winner: string | null;
  words: string[] | null;
  wordAssignments: Record<string, WordAssignment> | null;
  revealedWords: string[] | null;
  currentClue: string | null;
  currentClueNumber: number | null;
  guessesRemaining: number | null;
};

type PlayerRecord = {
  id: string;
  userId: string;
  team: 'red' | 'blue';
  role: 'spymaster' | 'operative' | 'pending';
  vellumAgentId: string | null;
  agentDisplayName: string | null;
  username: string;
};

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<GameRecord | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const fetchGameData = useCallback(async () => {
    if (!gameId) return;
    const res = await fetch(`/api/games/${gameId}`);
    if (res.ok) {
      const data = await res.json();
      setGame(data.game);
      setPlayers(data.players ?? []);
    } else {
      setGame(null);
    }
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    fetchGameData();
    // Poll for updates in place of Supabase realtime channels
    const interval = setInterval(fetchGameData, 3000);
    return () => clearInterval(interval);
  }, [fetchGameData]);

  const startGame = async () => {
    setIsStarting(true);

    const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      toast({
        title: 'Cannot start game',
        description: data.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Roles assigned!',
        description: 'First player on each team is Spymaster, second is Operative.',
      });
    }

    await fetchGameData();
    setIsStarting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!game) return <div className="min-h-screen flex items-center justify-center"><p>Game not found</p></div>;

  const myPlayer = players.find(p => p.userId === user?.id);
  const isHost = game.hostUserId === user?.id;
  const redPlayers = players.filter(p => p.team === 'red');
  const bluePlayers = players.filter(p => p.team === 'blue');
  const words = game.words ?? [];
  const wordAssignments = game.wordAssignments ?? {};
  const revealedWords = game.revealedWords ?? [];
  const redRemaining = words.filter(w => wordAssignments[w] === 'red' && !revealedWords.includes(w)).length;
  const blueRemaining = words.filter(w => wordAssignments[w] === 'blue' && !revealedWords.includes(w)).length;

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft className="h-5 w-5" /></Button>
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
            <TeamPanel team="red" players={redPlayers} remainingWords={redRemaining} isCurrentTeam={game.currentTeam === 'red'} />
            <TeamPanel team="blue" players={bluePlayers} remainingWords={blueRemaining} isCurrentTeam={game.currentTeam === 'blue'} />
            {!myPlayer && game.status === 'waiting' && <JoinGamePanel gameId={gameId as string} existingPlayers={players} onJoined={fetchGameData} />}
            {game.status === 'in_progress' && (
              <GameControls
                gameId={gameId as string}
                currentTeam={game.currentTeam as 'red' | 'blue' | null}
                currentPhase={game.currentPhase}
                players={players}
                isHost={isHost}
                winner={game.winner}
                onStateChange={fetchGameData}
              />
            )}
          </div>
          <div className="lg:col-span-3 space-y-4">
            {(game.status === 'in_progress' || game.status === 'finished') && (
              <>
                <ClueDisplay clue={game.currentClue} number={game.currentClueNumber} currentTeam={game.currentTeam} guessesRemaining={game.guessesRemaining} />
                <GameBoard words={words} wordAssignments={wordAssignments} revealedWords={revealedWords} isSpymaster={myPlayer?.role === 'spymaster'} disabled={true} />
              </>
            )}
            {game.status === 'waiting' && (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground mb-2">Waiting for players to join...</p>
                  <p className="text-sm text-muted-foreground">
                    {players.length}/4 players
                    {players.length >= 4 && ' - Ready to start!'}
                  </p>
                  {players.length >= 4 && isHost && (
                    <Button onClick={startGame} disabled={isStarting} size="lg" className="mt-4">
                      {isStarting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                      Start Game
                    </Button>
                  )}
                  {players.length >= 4 && !isHost && (
                    <p className="text-sm text-muted-foreground italic">Waiting for host to start...</p>
                  )}
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
