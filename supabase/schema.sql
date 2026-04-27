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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('manager','locopilot','user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_no TEXT UNIQUE NOT NULL,
  train_name TEXT NOT NULL DEFAULT '',
  train_type TEXT NOT NULL CHECK (train_type IN ('rajdhani','express','passenger','goods')),
  max_speed INT NOT NULL DEFAULT 110,
  schedule_status TEXT NOT NULL DEFAULT 'on-time' CHECK (schedule_status IN ('delayed','on-time','early')),
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

-- Demo policies: anon read everywhere
DO $$ BEGIN
  CREATE POLICY "anon read users"          ON users          FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon read trains"         ON trains         FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon read schedule"       ON train_schedule FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon read locations"      ON live_locations FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon read decisions"      ON decisions      FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon read incidents"      ON incidents      FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon read weather"        ON weather_data   FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Demo write paths
DO $$ BEGIN
  CREATE POLICY "anon insert locations"    ON live_locations FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon insert decisions"    ON decisions      FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon update decisions"    ON decisions      FOR UPDATE TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon insert incidents"    ON incidents      FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon update incidents"    ON incidents      FOR UPDATE TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon insert weather"      ON weather_data   FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon update trains"       ON trains         FOR UPDATE TO anon USING (true) WITH CHECK (true);
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
