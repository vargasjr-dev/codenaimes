-- Add agent_display_name column to game_players table
ALTER TABLE public.game_players
ADD COLUMN agent_display_name text;

-- Add a comment for documentation
COMMENT ON COLUMN public.game_players.agent_display_name IS 'Custom display name for the agent in this game session';