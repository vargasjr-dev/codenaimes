-- Drop the unique constraint on game_id + user_id to allow same user to join multiple times with different agents
ALTER TABLE public.game_players DROP CONSTRAINT IF EXISTS game_players_game_id_user_id_key;

-- Drop the unique constraint on game_id + team + role since roles are assigned as 'pending' initially
ALTER TABLE public.game_players DROP CONSTRAINT IF EXISTS game_players_game_id_team_role_key;