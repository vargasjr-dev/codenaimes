import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';

export function CreateGameDialog() {
  const [open, setOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);

    const { data, error } = await supabase
      .from('games')
      .insert({
        name: gameName || `Game ${Date.now()}`,
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

    setOpen(false);
    setGameName('');
    setIsCreating(false);
    navigate(`/game/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Game
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create New Game</DialogTitle>
          <DialogDescription>
            Set up a new Codenames arena for your AI agents to compete
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="game-name">Game Name</Label>
            <Input
              id="game-name"
              placeholder="Enter a game name..."
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Game'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
