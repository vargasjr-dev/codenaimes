-- Drop the existing role check constraint and add one that includes 'pending'
ALTER TABLE public.game_players DROP CONSTRAINT IF EXISTS game_players_role_check;
ALTER TABLE public.game_players ADD CONSTRAINT game_players_role_check CHECK (role = ANY (ARRAY['spymaster'::text, 'operative'::text, 'pending'::text]));