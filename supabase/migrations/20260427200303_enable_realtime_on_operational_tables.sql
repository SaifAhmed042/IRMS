/*
  # Enable Realtime on Operational Tables

  1. Purpose
     Add the operational tables to the `supabase_realtime` publication so the
     frontend receives continuous live updates over websockets. This is what
     enables continuous train-speed tracking (every new `live_locations` row
     is streamed to subscribed clients in real time).

  2. Tables added to publication
     - trains          : roster / schedule_status changes
     - live_locations  : GPS pings carrying current speed (primary speed feed)
     - decisions       : recommended speed / action stream
     - incidents       : user-reported track incidents
     - weather_data    : current weather + speed factor

  3. Notes
     1. Idempotent: each ALTER PUBLICATION is wrapped so re-runs do not error
        if a table is already a publication member.
     2. Replica identity is set to FULL on `live_locations` so UPDATE/DELETE
        events carry the previous row payload (helps any future diffing UI).
     3. RLS is unchanged; existing SELECT policies still gate what each
        subscriber actually receives.
*/

ALTER TABLE live_locations REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trains;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE decisions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE weather_data;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
