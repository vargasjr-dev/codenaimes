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
import { ArrowLeft, Play, Loader2, Trophy, Link2, Check } from "lucide-react";
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
  updatedAt: string | null;
};

type PlayerRecord = {
  id: string;
  userId: string;
  team: 'red' | 'blue';
  role: 'spymaster' | 'operative' | 'pending';
  agentDisplayName: string | null;
  isAgent?: boolean;
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
  const [linkCopied, setLinkCopied] = useState(false);
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
    }

    await fetchGameData();
    setIsStarting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!game) return <div className="min-h-screen flex items-center justify-center"><p>Game not found</p></div>;

  const myPlayer = players.find(p => p.userId === user?.id && !p.isAgent);
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
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/')}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="font-display text-lg font-bold truncate">{game.name}</h1>
          </div>
          {isHost && game.status === 'waiting' && (
            <Button size="sm" onClick={startGame} disabled={isStarting || players.length < 4}>
              {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start Game
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-3 py-3">
        {game.status === 'waiting' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-1 space-y-2">
              <TeamPanel team="red" players={redPlayers} remainingWords={redRemaining} isCurrentTeam={false} />
              <TeamPanel team="blue" players={bluePlayers} remainingWords={blueRemaining} isCurrentTeam={false} />
              <JoinGamePanel gameId={gameId as string} existingPlayers={players} onJoined={fetchGameData} />
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                  toast({ title: 'Link copied!', description: 'Send it to friends so they can join this room.' });
                }}
              >
                {linkCopied ? <Check className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
                {linkCopied ? 'Link Copied!' : 'Share Room Link'}
              </Button>
            </div>
            <div className="lg:col-span-3" />
          </div>
        )}

        {(game.status === 'in_progress' || game.status === 'finished') && (
          <div className="space-y-2">
            {game.status === 'finished' && game.winner ? (
              <div className={cn(
                "text-center py-6 rounded-lg border-2",
                game.winner === 'red' ? "border-team-red bg-team-red/10 card-glow-red" : "border-team-blue bg-team-blue/10 card-glow-blue"
              )}>
                <Trophy className={cn(
                  "h-10 w-10 mx-auto mb-3",
                  game.winner === 'red' ? "text-team-red" : "text-team-blue"
                )} />
                <h2 className={cn(
                  "text-2xl font-display font-bold",
                  game.winner === 'red' ? "text-team-red" : "text-team-blue"
                )}>
                  {game.winner.toUpperCase()} TEAM WINS!
                </h2>
              </div>
            ) : (
              <ClueDisplay clue={game.currentClue} number={game.currentClueNumber} currentTeam={game.currentTeam} guessesRemaining={game.guessesRemaining} />
            )}
            <GameBoard words={words} wordAssignments={wordAssignments} revealedWords={revealedWords} isSpymaster={myPlayer?.role === 'spymaster'} disabled={true} />

            <GameControls
              gameId={gameId as string}
              currentTeam={game.currentTeam as 'red' | 'blue' | null}
              currentPhase={game.currentPhase}
              players={players}
              isHost={isHost}
              winner={game.winner}
              updatedAt={game.updatedAt}
              myPlayer={myPlayer ? { team: myPlayer.team, role: myPlayer.role, isAgent: myPlayer.isAgent } : null}
              maxClueNumber={game.currentTeam === 'red' ? redRemaining : blueRemaining}
              onStateChange={fetchGameData}
            />
          </div>
        )}
      </main>
    </div>
  );
}
