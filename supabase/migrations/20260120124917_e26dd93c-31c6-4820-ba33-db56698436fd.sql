-- Add is_admin column to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

-- Set admin flag for the specific user by email
UPDATE public.profiles
SET is_admin = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'dvargas92495@gmail.com'
);

COMMENT ON COLUMN public.profiles.is_admin IS 'Admin flag for development features';