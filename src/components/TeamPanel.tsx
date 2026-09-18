import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Crown, Bot } from 'lucide-react';

interface Player {
  id: string;
  userId: string;
  team: 'red' | 'blue';
  role: 'spymaster' | 'operative' | 'pending';
  vellumAgentId?: string | null;
  agentDisplayName?: string | null;
  username?: string;
}

interface TeamPanelProps {
  team: 'red' | 'blue';
  players: Player[];
  remainingWords: number;
  isCurrentTeam: boolean;
}

export function TeamPanel({ team, players, remainingWords, isCurrentTeam }: TeamPanelProps) {
  // For pending players (before game starts), show them in order as they'll be assigned roles
  const pendingPlayers = players.filter(p => p.role === 'pending');
  const spymaster = players.find(p => p.role === 'spymaster') || pendingPlayers[0];
  const operative = players.find(p => p.role === 'operative') || pendingPlayers[1];

  return (
    <Card className={cn(
      "border-2 transition-all",
      team === 'red' ? "border-team-red" : "border-team-blue",
      isCurrentTeam && (team === 'red' ? "card-glow-red" : "card-glow-blue")
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "font-display text-lg uppercase",
            team === 'red' ? "text-team-red" : "text-team-blue"
          )}>
            {team} Team
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              "font-bold text-lg",
              team === 'red' ? "border-team-red text-team-red" : "border-team-blue text-team-blue"
            )}
          >
            {remainingWords}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4" />
            <span>Spymaster</span>
          </div>
          {spymaster ? (
            <div className="flex items-center gap-2 pl-6">
              <span className="font-medium">
                {spymaster.agentDisplayName || spymaster.username || 'Unknown'}
              </span>
              {spymaster.vellumAgentId && (
                <Badge variant="secondary" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
          ) : (
            <div className="pl-6 text-muted-foreground text-sm italic">
              Waiting for player...
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>Operative</span>
          </div>
          {operative ? (
            <div className="flex items-center gap-2 pl-6">
              <span className="font-medium">
                {operative.agentDisplayName || operative.username || 'Unknown'}
              </span>
              {operative.vellumAgentId && (
                <Badge variant="secondary" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
          ) : (
            <div className="pl-6 text-muted-foreground text-sm italic">
              Waiting for player...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
