/*
  # Seed Train Schedules with Arrival Times

  1. Purpose
     Populate `train_schedule` for all five demo trains along the
     Delhi–Mumbai corridor with realistic arrival_time / departure_time
     timestamps. This data drives station-level conflict resolution:
     when two trains are scheduled to arrive at the same station within
     a small window, the decision engine compares train-type priority
     and asks the lower-priority train to slow down.

  2. Notes
     1. Idempotent: each block checks `NOT EXISTS` before inserting, so
        running the migration twice does not duplicate rows.
     2. Times are stored as TIMESTAMPTZ anchored to today's date so the
        demo always has fresh, near-future arrivals.
     3. Punjab Mail (express) is intentionally scheduled to arrive at
        Bhopal around the same window as Mumbai Rajdhani so a clash is
        guaranteed in the demo.
*/

DO $$
DECLARE
  rid UUID;
  base TIMESTAMPTZ := date_trunc('day', now()) + interval '6 hours';
BEGIN
  -- Mumbai Rajdhani (12951) — already seeded without times; backfill them.
  SELECT id INTO rid FROM trains WHERE train_no = '12951';
  IF rid IS NOT NULL THEN
    UPDATE train_schedule SET
      arrival_time   = base + (stop_order - 1) * interval '70 minutes',
      departure_time = base + (stop_order - 1) * interval '70 minutes' + interval '5 minutes'
    WHERE train_id = rid AND arrival_time IS NULL;
  END IF;

  -- Punjab Mail (12137) — clash with Rajdhani at Bhopal.
  SELECT id INTO rid FROM trains WHERE train_no = '12137';
  IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM train_schedule WHERE train_id = rid) THEN
    INSERT INTO train_schedule (train_id, station_name, station_lat, station_lng, stop_order, arrival_time, departure_time) VALUES
      (rid, 'New Delhi', 28.6139, 77.2090, 1, base + interval '15 minutes',  base + interval '20 minutes'),
      (rid, 'Mathura',   27.4924, 77.6737, 2, base + interval '85 minutes',  base + interval '90 minutes'),
      (rid, 'Agra',      27.1767, 78.0081, 3, base + interval '155 minutes', base + interval '160 minutes'),
      (rid, 'Gwalior',   26.2183, 78.1828, 4, base + interval '225 minutes', base + interval '230 minutes'),
      (rid, 'Jhansi',    25.4484, 78.5685, 5, base + interval '295 minutes', base + interval '300 minutes'),
      (rid, 'Bhopal',    23.2599, 77.4126, 6, base + interval '355 minutes', base + interval '362 minutes'),
      (rid, 'Itarsi',    22.6131, 77.7626, 7, base + interval '425 minutes', base + interval '430 minutes'),
      (rid, 'Nagpur',    21.1458, 79.0882, 8, base + interval '495 minutes', base + interval '500 minutes');
  END IF;

  -- Karnataka Express (12627)
  SELECT id INTO rid FROM trains WHERE train_no = '12627';
  IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM train_schedule WHERE train_id = rid) THEN
    INSERT INTO train_schedule (train_id, station_name, station_lat, station_lng, stop_order, arrival_time, departure_time) VALUES
      (rid, 'New Delhi', 28.6139, 77.2090, 1, base + interval '40 minutes',  base + interval '45 minutes'),
      (rid, 'Agra',      27.1767, 78.0081, 2, base + interval '180 minutes', base + interval '185 minutes'),
      (rid, 'Jhansi',    25.4484, 78.5685, 3, base + interval '320 minutes', base + interval '325 minutes'),
      (rid, 'Bhopal',    23.2599, 77.4126, 4, base + interval '400 minutes', base + interval '410 minutes'),
      (rid, 'Nagpur',    21.1458, 79.0882, 5, base + interval '540 minutes', base + interval '545 minutes');
  END IF;

  -- Grand Trunk (12615) passenger
  SELECT id INTO rid FROM trains WHERE train_no = '12615';
  IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM train_schedule WHERE train_id = rid) THEN
    INSERT INTO train_schedule (train_id, station_name, station_lat, station_lng, stop_order, arrival_time, departure_time) VALUES
      (rid, 'New Delhi', 28.6139, 77.2090, 1, base + interval '60 minutes',  base + interval '65 minutes'),
      (rid, 'Mathura',   27.4924, 77.6737, 2, base + interval '140 minutes', base + interval '145 minutes'),
      (rid, 'Agra',      27.1767, 78.0081, 3, base + interval '220 minutes', base + interval '225 minutes'),
      (rid, 'Jhansi',    25.4484, 78.5685, 4, base + interval '360 minutes', base + interval '365 minutes'),
      (rid, 'Bhopal',    23.2599, 77.4126, 5, base + interval '450 minutes', base + interval '460 minutes');
  END IF;

  -- Freight 401 (GD401) goods — slowest, runs through Bhopal late.
  SELECT id INTO rid FROM trains WHERE train_no = 'GD401';
  IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM train_schedule WHERE train_id = rid) THEN
    INSERT INTO train_schedule (train_id, station_name, station_lat, station_lng, stop_order, arrival_time, departure_time) VALUES
      (rid, 'New Delhi', 28.6139, 77.2090, 1, base + interval '90 minutes',  base + interval '100 minutes'),
      (rid, 'Agra',      27.1767, 78.0081, 2, base + interval '260 minutes', base + interval '270 minutes'),
      (rid, 'Bhopal',    23.2599, 77.4126, 3, base + interval '500 minutes', base + interval '515 minutes'),
      (rid, 'Nagpur',    21.1458, 79.0882, 4, base + interval '660 minutes', base + interval '670 minutes');
  END IF;
END $$;
