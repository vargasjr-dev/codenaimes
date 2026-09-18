"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle, Settings, Zap } from 'lucide-react';

interface VellumDeployment {
  id: string;
  name: string;
  label: string;
  description: string;
}

interface JoinGamePanelProps {
  gameId: string;
  existingPlayers: Array<{
    team: string;
    role: string;
    userId: string;
  }>;
  onJoined: () => void;
}

const QUICK_FILL_NAMES = [
  'Alpha Agent',
  'Beta Agent',
  'Gamma Agent',
  'Delta Agent',
];

export function JoinGamePanel({ gameId, existingPlayers, onJoined }: JoinGamePanelProps) {
  const [team, setTeam] = useState<'red' | 'blue'>('red');
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [agentDisplayName, setAgentDisplayName] = useState('');
  const [deployments, setDeployments] = useState<VellumDeployment[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(true);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isQuickFilling, setIsQuickFilling] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchDeployments();
      setIsAdmin(user.isAdmin ?? false);
    }
  }, [user]);

  const fetchDeployments = async () => {
    setIsLoadingDeployments(true);
    setDeploymentError(null);

    try {
      const response = await fetch('/api/vellum/deployments');
      const data = await response.json();

      if (data.error && data.deployments?.length === 0) {
        setDeploymentError(data.error);
      } else if (data.deployments) {
        setDeployments(data.deployments);
        if (data.deployments.length > 0) {
          setSelectedDeployment(data.deployments[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching deployments:', error);
      setDeploymentError('Failed to load deployments');
    }

    setIsLoadingDeployments(false);
  };

  const isTeamFull = (t: string) => {
    return existingPlayers.filter(p => p.team === t).length >= 2;
  };

  const isAlreadyJoined = existingPlayers.some(p => p.userId === user?.id);

  const handleQuickFillAll = async () => {
    if (!user || !selectedDeployment) return;

    setIsQuickFilling(true);

    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickFill: true, vellumAgentId: selectedDeployment }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Failed to fill spots',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'All spots filled!',
          description: `Added ${data.added} agents to the game.`,
        });
        onJoined();
      }
    } catch (error) {
      console.error('Error quick filling:', error);
      toast({
        title: 'Error',
        description: 'Failed to fill all spots.',
        variant: 'destructive',
      });
    }

    setIsQuickFilling(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isTeamFull(team)) {
      toast({
        title: 'Team full',
        description: 'This team already has 2 players.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedDeployment) {
      toast({
        title: 'Agent required',
        description: 'Please select a Vellum workflow deployment.',
        variant: 'destructive',
      });
      return;
    }

    if (!agentDisplayName.trim()) {
      toast({
        title: 'Agent name required',
        description: 'Please enter a display name for your agent.',
        variant: 'destructive',
      });
      return;
    }

    setIsJoining(true);

    const res = await fetch(`/api/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, vellumAgentId: selectedDeployment, agentDisplayName: agentDisplayName.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({
        title: 'Failed to join',
        description: data.error,
        variant: 'destructive',
      });
      setIsJoining(false);
      return;
    }

    toast({
      title: 'Joined game!',
      description: `You are now on the ${team} team.`,
    });

    onJoined();
    setIsJoining(false);
  };

  if (isAlreadyJoined && !isAdmin) {
    return null;
  }

  const allSpotsFilled = existingPlayers.length >= 4;

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="font-display">Join Game</CardTitle>
        <CardDescription>
          Select your team and choose your Vellum agent
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
                  disabled={isTeamFull('red')}
                />
                <Label htmlFor="team-red" className="text-team-red font-semibold">
                  Red Team {isTeamFull('red') && '(Full)'}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="blue"
                  id="team-blue"
                  disabled={isTeamFull('blue')}
                />
                <Label htmlFor="team-blue" className="text-team-blue font-semibold">
                  Blue Team {isTeamFull('blue') && '(Full)'}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deployment">Vellum Workflow</Label>
            {isLoadingDeployments ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading workflows...
              </div>
            ) : deploymentError ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {deploymentError}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/profile')}
                  className="w-full"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configure API Key in Profile
                </Button>
              </div>
            ) : deployments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">
                No workflow deployments found. Create one in Vellum first.
              </div>
            ) : (
              <Select value={selectedDeployment} onValueChange={setSelectedDeployment}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a workflow..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {deployments.map((deployment) => (
                    <SelectItem key={deployment.id} value={deployment.id}>
                      <div className="flex flex-col">
                        <span>{deployment.label || deployment.name}</span>
                        {deployment.description && (
                          <span className="text-xs text-muted-foreground">{deployment.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Your Vellum API key from your profile will be used
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Display Name</Label>
            <Input
              id="agentName"
              placeholder="e.g., My Clever Agent, Test Bot v2..."
              value={agentDisplayName}
              onChange={(e) => setAgentDisplayName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Give your agent a unique name for this game
            </p>
          </div>

          {!allSpotsFilled && (
            <Button
              type="submit"
              className="w-full"
              disabled={isJoining || isLoadingDeployments || !selectedDeployment || !agentDisplayName.trim() || !!deploymentError}
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

          {isAdmin && !allSpotsFilled && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleQuickFillAll}
              disabled={isQuickFilling || isLoadingDeployments || !selectedDeployment || !!deploymentError}
            >
              {isQuickFilling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Filling all spots...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Quick Fill All Spots (Dev)
                </>
              )}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
