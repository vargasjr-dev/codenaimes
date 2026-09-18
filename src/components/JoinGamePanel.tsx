'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Bot, User } from 'lucide-react';

interface JoinGamePanelProps {
  gameId: string;
  existingPlayers: Array<{
    team: string;
    role: string;
    userId: string;
    isAgent?: boolean;
  }>;
  onJoined: () => void;
}

export function JoinGamePanel({ gameId, existingPlayers, onJoined }: JoinGamePanelProps) {
  const [team, setTeam] = useState<'red' | 'blue'>('red');
  const [isJoining, setIsJoining] = useState(false);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const { user, playAsGuest } = useAuth();
  const { toast } = useToast();

  const [guestName, setGuestName] = useState('');
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  const isTeamFull = (t: string) => {
    return existingPlayers.filter((p) => p.team === t).length >= 2;
  };

  // Agent rows belong to whoever added them — they don't count as "already joined"
  const isAlreadyJoined = existingPlayers.some((p) => p.userId === user?.id && !p.isAgent);

  const allSpotsFilled = existingPlayers.length >= 4;

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    setIsCreatingGuest(true);
    const { error } = await playAsGuest(guestName.trim());
    setIsCreatingGuest(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleJoin = async (addAgent: boolean) => {
    if (!user) return;

    if (isTeamFull(team)) {
      toast({
        title: 'Team full',
        description: 'This team already has 2 players.',
        variant: 'destructive',
      });
      return;
    }

    if (addAgent) {
      setIsAddingAgent(true);
    } else {
      setIsJoining(true);
    }

    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, addAgent }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: addAgent ? 'Failed to add agent' : 'Failed to join',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: addAgent ? 'Jev added!' : 'Joined game!',
        description: addAgent
          ? `Jev is playing on the ${team} team.`
          : `You are now on the ${team} team.`,
      });

      onJoined();
    } catch (error) {
      console.error('Error joining:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingAgent(false);
      setIsJoining(false);
    }
  };

  if (allSpotsFilled) {
    return null;
  }

  if (!user) {
    return (
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="font-display">Join Game</CardTitle>
          <CardDescription>
            No account needed — just tell us your name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGuest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guestName">Your Name</Label>
              <Input
                id="guestName"
                placeholder="e.g., Alex"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isCreatingGuest || !guestName.trim()}
            >
              {isCreatingGuest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Continue &amp; Join
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Have an account? <a href="/auth" className="underline">Sign in</a> first.
            </p>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="font-display">
          {isAlreadyJoined ? 'Fill Empty Seats' : 'Join Game'}
        </CardTitle>
        <CardDescription>
          {isAlreadyJoined
            ? 'Add Jev to any open seat, or share the room link'
            : 'Pick a team — play yourself or add Jev as your teammate'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label>Team</Label>
          <RadioGroup
            value={team}
            onValueChange={(v) => setTeam(v as 'red' | 'blue')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="red" id="team-red" disabled={isTeamFull('red')} />
              <Label htmlFor="team-red" className="text-team-red font-semibold">
                Red Team {isTeamFull('red') && '(Full)'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="blue" id="team-blue" disabled={isTeamFull('blue')} />
              <Label htmlFor="team-blue" className="text-team-blue font-semibold">
                Blue Team {isTeamFull('blue') && '(Full)'}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {!isAlreadyJoined && (
          <Button
            className="w-full"
            disabled={isJoining || isAddingAgent || isTeamFull(team)}
            onClick={() => handleJoin(false)}
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Game'
            )}
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={isJoining || isAddingAgent || isTeamFull(team)}
          onClick={() => handleJoin(true)}
        >
          {isAddingAgent ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Jev...
            </>
          ) : (
            <>
              <Bot className="mr-2 h-4 w-4" />
              Add Jev Agent to Team
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
