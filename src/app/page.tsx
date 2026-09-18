"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { GameLobbyList } from "@/components/GameLobbyList";
import { CreateGameDialog } from "@/components/CreateGameDialog";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Zap, BookOpen, User } from "lucide-react";

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
    return (
      <AuthRedirect />
    );
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold text-gradient-primary">CodenAImes</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/how-to" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">How To</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
            </Button>
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

      <footer className="border-t border-border mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 VargasJR LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function AuthRedirect() {
  // Client-side redirect for unauthenticated visitors
  if (typeof window !== "undefined") {
    window.location.replace("/auth");
  }
  return null;
}
