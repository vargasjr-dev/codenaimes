import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

interface JoinGamePanelProps {
  gameId: string;
  existingPlayers: Array<{
    team: string;
    role: string;
    user_id: string;
  }>;
  onJoined: () => void;
}

export function JoinGamePanel({ gameId, existingPlayers, onJoined }: JoinGamePanelProps) {
  const [team, setTeam] = useState<'red' | 'blue'>('red');
  const [role, setRole] = useState<'spymaster' | 'operative'>('spymaster');
  const [vellumAgentId, setVellumAgentId] = useState('');
  const [vellumApiKey, setVellumApiKey] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const isSlotTaken = (t: string, r: string) => {
    return existingPlayers.some(p => p.team === t && p.role === r);
  };

  const isAlreadyJoined = existingPlayers.some(p => p.user_id === user?.id);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isSlotTaken(team, role)) {
      toast({
        title: 'Slot taken',
        description: 'This team/role combination is already taken.',
        variant: 'destructive',
      });
      return;
    }

    if (!vellumAgentId.trim()) {
      toast({
        title: 'Agent ID required',
        description: 'Please enter your Vellum Agent ID.',
        variant: 'destructive',
      });
      return;
    }

    if (!vellumApiKey.trim()) {
      toast({
        title: 'API Key required',
        description: 'Please enter your Vellum API Key.',
        variant: 'destructive',
      });
      return;
    }

    setIsJoining(true);

    const { error } = await supabase
      .from('game_players')
      .insert({
        game_id: gameId,
        user_id: user.id,
        team,
        role,
        vellum_agent_id: vellumAgentId,
        vellum_api_key: vellumApiKey,
      });

    if (error) {
      toast({
        title: 'Failed to join',
        description: error.message,
        variant: 'destructive',
      });
      setIsJoining(false);
      return;
    }

    toast({
      title: 'Joined game!',
      description: `You are now the ${team} team ${role}.`,
    });

    onJoined();
    setIsJoining(false);
  };

  if (isAlreadyJoined) {
    return null;
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="font-display">Join Game</CardTitle>
        <CardDescription>
          Select your team, role, and configure your Vellum agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-3">
            <Label>Team</Label>
            <RadioGroup
              value={team}
              onValueChange={(v) => setTeam(v as 'red' | 'blue')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="red" 
                  id="team-red" 
                  disabled={isSlotTaken('red', 'spymaster') && isSlotTaken('red', 'operative')}
                />
                <Label htmlFor="team-red" className="text-team-red font-semibold">
                  Red Team
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="blue" 
                  id="team-blue"
                  disabled={isSlotTaken('blue', 'spymaster') && isSlotTaken('blue', 'operative')}
                />
                <Label htmlFor="team-blue" className="text-team-blue font-semibold">
                  Blue Team
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Role</Label>
            <RadioGroup
              value={role}
              onValueChange={(v) => setRole(v as 'spymaster' | 'operative')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="spymaster" 
                  id="role-spymaster"
                  disabled={isSlotTaken(team, 'spymaster')}
                />
                <Label htmlFor="role-spymaster">Spymaster</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="operative" 
                  id="role-operative"
                  disabled={isSlotTaken(team, 'operative')}
                />
                <Label htmlFor="role-operative">Operative</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vellum-agent">Vellum Agent ID</Label>
            <Input
              id="vellum-agent"
              placeholder="Enter your Vellum Agent ID"
              value={vellumAgentId}
              onChange={(e) => setVellumAgentId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vellum-key">Vellum API Key</Label>
            <Input
              id="vellum-key"
              type="password"
              placeholder="Enter your Vellum API Key"
              value={vellumApiKey}
              onChange={(e) => setVellumApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your API key is stored securely and used only for this game
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isJoining}>
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Game'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
