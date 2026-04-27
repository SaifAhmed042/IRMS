/*
  # Profiles linked to auth.users with role-based access

  1. New tables
     - `profiles`
       - `id` (uuid, PK, references auth.users)
       - `full_name` (text)
       - `role` (text: manager | locopilot | user)
       - `created_at` (timestamptz)

  2. Security
     - RLS enabled on `profiles`
     - SELECT: a user can read their own profile
     - INSERT: a user can insert their own profile (id = auth.uid())
     - UPDATE: a user can update their own profile

  3. Trigger
     - `handle_new_user` automatically creates a profile row when a new
       auth user is created. Reads `full_name` and `role` from
       `raw_user_meta_data`. Defaults role to 'user' if not provided
       or invalid.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('manager','locopilot','user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
  safe_role TEXT;
BEGIN
  meta_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  safe_role := CASE WHEN meta_role IN ('manager','locopilot','user') THEN meta_role ELSE 'user' END;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    safe_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
