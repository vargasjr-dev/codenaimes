-- Create games table
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
  current_team TEXT CHECK (current_team IN ('red', 'blue')),
  current_phase TEXT CHECK (current_phase IN ('spymaster_clue', 'operative_guess')),
  winner TEXT CHECK (winner IN ('red', 'blue')),
  words JSONB,
  word_assignments JSONB,
  revealed_words JSONB DEFAULT '[]'::jsonb,
  current_clue TEXT,
  current_clue_number INTEGER,
  guesses_remaining INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Create game_players table
CREATE TABLE public.game_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('red', 'blue')),
  role TEXT NOT NULL CHECK (role IN ('spymaster', 'operative')),
  vellum_agent_id TEXT,
  vellum_api_key TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id),
  UNIQUE(game_id, team, role)
);

-- Enable RLS on game_players
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Anyone can view games" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create games" ON public.games
  FOR INSERT WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update game" ON public.games
  FOR UPDATE USING (auth.uid() = host_user_id);

-- Game players policies
CREATE POLICY "Anyone can view game players" ON public.game_players
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join games" ON public.game_players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own player entry" ON public.game_players
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave games" ON public.game_players
  FOR DELETE USING (auth.uid() = user_id);