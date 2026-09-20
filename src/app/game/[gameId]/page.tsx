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
import { buildShareText } from "@/lib/share";
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

  // When the iOS keyboard opens it overlays the visual viewport without
  // resizing the layout — expose the overlap so the pinned footer can
  // lift the clue input above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-overlap', `${overlap}px`);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      document.documentElement.style.removeProperty('--keyboard-overlap');
    };
  }, []);
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

  const shareResult = async () => {
    if (!game) return;
    let text = "";
    try {
      const res = await fetch(`/api/games/${gameId}/events`);
      const data = await res.json();
      text = buildShareText({
        words,
        wordAssignments,
        revealedWords,
        winner: game.winner,
        myTeam: myPlayer?.team === "red" || myPlayer?.team === "blue" ? myPlayer.team : null,
        events: data.events ?? [],
        gameUrl: window.location.origin,
      });
    } catch {
      return;
    }
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
    );
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

  const [isGuessing, setIsGuessing] = useState(false);
  const canGuess = !!(
    game.status === 'in_progress' &&
    game.currentPhase === 'operative_guess' &&
    myPlayer &&
    myPlayer.role !== 'spymaster' &&
    myPlayer.team === game.currentTeam &&
    (game.guessesRemaining ?? 0) > 0
  );

  const handleGuess = async (word: string) => {
    if (isGuessing) return;
    setIsGuessing(true);
    try {
      const res = await fetch(`/api/games/${gameId}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? 'Guess failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Guess failed — try again', variant: 'destructive' });
    } finally {
      setIsGuessing(false);
      fetchGameData();
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background grid-pattern flex flex-col">
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

      <main className="container mx-auto px-3 py-3 flex-1 flex flex-col w-full">
        {game.status === 'waiting' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-1 space-y-2">
              <TeamPanel team="blue" players={bluePlayers} remainingWords={blueRemaining} isCurrentTeam={false} />
              <TeamPanel team="red" players={redPlayers} remainingWords={redRemaining} isCurrentTeam={false} />
              <JoinGamePanel gameId={gameId as string} existingPlayers={players} onJoined={fetchGameData} />
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
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
          <div className="flex-1 flex flex-col gap-2">
            <GameBoard words={words} wordAssignments={wordAssignments} revealedWords={revealedWords} isSpymaster={myPlayer?.role === 'spymaster'} disabled={!canGuess || isGuessing} onWordClick={handleGuess} />

            <div
              className="mt-auto space-y-2"
              style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) + var(--keyboard-overlap, 0px)), 0.75rem)' }}
            >
              {game.status === 'finished' && game.winner ? (
                <div className={cn(
                  "rounded-lg border-2 py-4",
                  game.winner === 'red' ? "border-team-red bg-team-red/10" : "border-team-blue bg-team-blue/10"
                )}>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <Trophy className={cn(
                      "h-6 w-6",
                      game.winner === 'red' ? "text-team-red" : "text-team-blue"
                    )} />
                    <span className={cn(
                      "text-2xl font-display font-bold",
                      game.winner === 'red' ? "text-team-red" : "text-team-blue"
                    )}>
                      {game.winner.toUpperCase()} WINS!
                    </span>
                    <Button variant="outline" size="sm" onClick={shareResult}>
                      <Link2 className="mr-2 h-4 w-4" />Share on X
                    </Button>
                  </div>
                </div>
              ) : (
                <ClueDisplay clue={game.currentClue} number={game.currentClueNumber} currentTeam={game.currentTeam} guessesRemaining={game.guessesRemaining} />
              )}
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
              redRemaining={redRemaining}
              blueRemaining={blueRemaining}
              onStateChange={fetchGameData}
            />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
