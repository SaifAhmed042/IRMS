/*
  # IRMS – Intelligent Rail Management System Schema

  Run this file in the Supabase SQL editor. It is idempotent: safe to re-run.

  1. Tables
    - users           : roles (manager, locopilot, user)
    - trains          : train roster + type + max speed
    - train_schedule  : station-by-station schedule per train
    - live_locations  : streamed GPS pings from loco pilot mobiles
    - decisions       : per-tick decision (recommended speed, action, reason, ai_explanation)
    - incidents       : user-reported track incidents with image
    - weather_data    : per-location current weather + speed factor
  2. Security
    - Enable RLS on every table
    - Anonymous read for operational tables (demo)
    - Anonymous insert/update for demo write paths (locations, decisions, incidents, weather)
  3. Seed
    - Delhi–Mumbai corridor stations
    - 5 trains across all categories
    - Baseline weather and schedule rows
*/

-- =====================================================================
-- TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('manager','locopilot','user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to automatically create a user in the public.users table when a new auth user signs up
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

  INSERT INTO public.users (id, name, role)
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

CREATE TABLE IF NOT EXISTS trains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_no TEXT UNIQUE NOT NULL,
  train_name TEXT NOT NULL DEFAULT '',
  train_type TEXT NOT NULL CHECK (train_type IN ('rajdhani','express','passenger','goods')),
  max_speed INT NOT NULL DEFAULT 110,
  schedule_status TEXT NOT NULL DEFAULT 'on-time' CHECK (schedule_status IN ('delayed','on-time','early')),
  pilot_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS train_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID REFERENCES trains(id) ON DELETE CASCADE,
  station_name TEXT NOT NULL,
  station_lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  station_lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  stop_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID REFERENCES trains(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed INT NOT NULL DEFAULT 0,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_locations_train_time
  ON live_locations(train_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID REFERENCES trains(id) ON DELETE CASCADE,
  recommended_speed INT NOT NULL DEFAULT 0,
  action TEXT NOT NULL DEFAULT 'PROCEED',
  reason TEXT NOT NULL DEFAULT '',
  ai_explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_train_time
  ON decisions(train_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'unknown',
  severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  reporter_name TEXT NOT NULL DEFAULT '',
  ai_alert TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weather_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT NOT NULL DEFAULT 'corridor',
  condition TEXT NOT NULL DEFAULT 'Normal',
  severity TEXT NOT NULL DEFAULT 'LOW',
  factor FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trains          ENABLE ROW LEVEL SECURITY;
ALTER TABLE train_schedule  ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_data    ENABLE ROW LEVEL SECURITY;

-- Demo policies: public read everywhere
DO $$ BEGIN
  CREATE POLICY "public read users"          ON users          FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read trains"         ON trains         FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read schedule"       ON train_schedule FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read locations"      ON live_locations FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read decisions"      ON decisions      FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read incidents"      ON incidents      FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read weather"        ON weather_data   FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Demo write paths
DO $$ BEGIN
  CREATE POLICY "public insert locations"    ON live_locations FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public insert decisions"    ON decisions      FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public update decisions"    ON decisions      FOR UPDATE TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public insert incidents"    ON incidents      FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public update incidents"    ON incidents      FOR UPDATE TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public insert weather"      ON weather_data   FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public update trains"       ON trains         FOR UPDATE TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- SEED DATA – Delhi–Mumbai corridor
-- =====================================================================

INSERT INTO trains (train_no, train_name, train_type, max_speed, schedule_status)
VALUES
  ('12951', 'Mumbai Rajdhani',     'rajdhani',  140, 'on-time'),
  ('12137', 'Punjab Mail',         'express',   110, 'delayed'),
  ('12627', 'Karnataka Express',   'express',   110, 'on-time'),
  ('12615', 'Grand Trunk',         'passenger',  90, 'early'),
  ('GD401', 'Freight 401',         'goods',      75, 'delayed')
ON CONFLICT (train_no) DO NOTHING;

INSERT INTO weather_data (location, condition, severity, factor)
SELECT 'corridor', 'Normal', 'LOW', 1.0
WHERE NOT EXISTS (SELECT 1 FROM weather_data WHERE location = 'corridor');

-- Schedule for Mumbai Rajdhani (12951) along corridor
DO $$
DECLARE rid UUID;
BEGIN
  SELECT id INTO rid FROM trains WHERE train_no = '12951';
  IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM train_schedule WHERE train_id = rid) THEN
    INSERT INTO train_schedule (train_id, station_name, station_lat, station_lng, stop_order) VALUES
      (rid, 'New Delhi', 28.6139, 77.2090, 1),
      (rid, 'Mathura',   27.4924, 77.6737, 2),
      (rid, 'Agra',      27.1767, 78.0081, 3),
      (rid, 'Gwalior',   26.2183, 78.1828, 4),
      (rid, 'Jhansi',    25.4484, 78.5685, 5),
      (rid, 'Bhopal',    23.2599, 77.4126, 6),
      (rid, 'Itarsi',    22.6131, 77.7626, 7),
      (rid, 'Nagpur',    21.1458, 79.0882, 8),
      (rid, 'Nashik',    19.9975, 73.7898, 9),
      (rid, 'Mumbai',    19.0760, 72.8777, 10);
  END IF;
END $$;
