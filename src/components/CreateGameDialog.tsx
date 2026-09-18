"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';

const adjectives = ['Shadow', 'Neon', 'Cyber', 'Quantum', 'Stealth', 'Crystal', 'Blazing', 'Frozen', 'Electric', 'Phantom', 'Midnight', 'Golden', 'Iron', 'Silent', 'Rapid'];
const nouns = ['Phoenix', 'Viper', 'Storm', 'Matrix', 'Nexus', 'Cipher', 'Eclipse', 'Horizon', 'Pulse', 'Omega', 'Specter', 'Titan', 'Nova', 'Raven', 'Falcon'];

function generateGameName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj} ${noun} ${num}`;
}

export function CreateGameDialog() {
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleCreate = async () => {
    if (!user) return;

    setIsCreating(true);

    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: generateGameName() }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({
        title: 'Failed to create game',
        description: data.error,
        variant: 'destructive',
      });
      setIsCreating(false);
      return;
    }

    toast({
      title: 'Room created!',
      description: 'Redirecting to game lobby...',
    });

    setIsCreating(false);
    router.push(`/game/${data.game.id}`);
  };

  return (
    <Button className="gap-2" onClick={handleCreate} disabled={isCreating}>
      {isCreating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Create Game
        </>
      )}
    </Button>
  );
}
