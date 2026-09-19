"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { GameHistory } from "@/components/GameHistory";
import { CreateGameDialog } from "@/components/CreateGameDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogOut, Zap, User } from "lucide-react";

export default function Index() {
  const { user, loading, playAsGuest, signOut } = useAuth();

  const [guestName, setGuestName] = useState("");
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background grid-pattern">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold text-gradient-primary">CodenAImes</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 max-w-md">
          <Card className="card-glow">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Welcome</CardTitle>
              <CardDescription>
                No account needed — enter your name and start playing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!guestName.trim()) return;
                  setIsCreatingGuest(true);
                  await playAsGuest(guestName.trim());
                  setIsCreatingGuest(false);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Alex"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isCreatingGuest || !guestName.trim()}>
                  {isCreatingGuest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Play as Guest"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Want an account instead?{" "}
                  <Link href="/auth" className="underline">
                    Sign in or sign up
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
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
            <CreateGameDialog />
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <GameHistory />
      </main>

      <footer className="border-t border-border mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 VargasJR LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
