import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!user) return;

    setIsCreating(true);

    const { data, error } = await supabase
      .from('games')
      .insert({
        name: generateGameName(),
        host_user_id: user.id,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Failed to create game',
        description: error.message,
        variant: 'destructive',
      });
      setIsCreating(false);
      return;
    }

    toast({
      title: 'Game created!',
      description: 'Redirecting to game lobby...',
    });

    setIsCreating(false);
    navigate(`/game/${data.id}`);
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
