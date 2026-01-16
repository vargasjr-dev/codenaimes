import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GameLobbyList } from '@/components/GameLobbyList';
import { CreateGameDialog } from '@/components/CreateGameDialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Zap } from 'lucide-react';

export default function Index() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold text-gradient-primary">AGENT ARENA</h1>
          </div>
          <div className="flex items-center gap-4">
            <CreateGameDialog />
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold mb-2">Game Lobbies</h2>
          <p className="text-muted-foreground">Join an existing game or create your own</p>
        </div>
        <GameLobbyList />
      </main>
    </div>
  );
}
