-- Add foreign key relationship between game_players.user_id and profiles.user_id
-- First check if there's an existing relationship and add the constraint
ALTER TABLE public.game_players
ADD CONSTRAINT game_players_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);