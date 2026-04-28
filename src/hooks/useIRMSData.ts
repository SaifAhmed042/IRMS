import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Decision, Incident, LiveLocation, ScheduleStop, Train, Weather } from '../lib/types';

export function useSchedules(): Map<string, ScheduleStop[]> {
  const [byTrain, setByTrain] = useState<Map<string, ScheduleStop[]>>(new Map());
  useEffect(() => {
    let mounted = true;
    const fetchSchedules = () => {
      supabase
        .from('train_schedule')
        .select('*')
        .order('stop_order')
        .then(({ data }) => {
          if (!mounted || !data) return;
          const map = new Map<string, ScheduleStop[]>();
          for (const row of data as ScheduleStop[]) {
            const arr = map.get(row.train_id) ?? [];
            arr.push(row);
            map.set(row.train_id, arr);
          }
          setByTrain(map);
        });
    };
    fetchSchedules();

    const ch = supabase
      .channel('schedule-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'train_schedule' }, fetchSchedules)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return byTrain;
}

export function useTrains() {
  const [trains, setTrains] = useState<Train[]>([]);
  useEffect(() => {
    let mounted = true;
    supabase
      .from('trains')
      .select('*')
      .order('train_no')
      .then(({ data }) => {
        if (mounted && data) setTrains(data as Train[]);
      });
    const ch = supabase
      .channel('trains-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trains' }, () => {
        supabase.from('trains').select('*').order('train_no').then(({ data }) => {
          if (data) setTrains(data as Train[]);
        });
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return trains;
}

export function useLatestLocations(): Map<string, LiveLocation> {
  const [byTrain, setByTrain] = useState<Map<string, LiveLocation>>(new Map());
  useEffect(() => {
    const ch = supabase
      .channel('locations-ch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_locations' },
        (payload) => {
          const row = payload.new as LiveLocation;
          setByTrain((prev) => {
            const next = new Map(prev);
            next.set(row.train_id, row);
            return next;
          });
        },
      )
      .subscribe();
    // initial fetch: latest per train
    supabase
      .from('live_locations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, LiveLocation>();
        for (const row of data as LiveLocation[]) {
          if (!map.has(row.train_id)) map.set(row.train_id, row);
        }
        setByTrain(map);
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  return byTrain;
}

export function useLatestDecisions(): Map<string, Decision> {
  const [byTrain, setByTrain] = useState<Map<string, Decision>>(new Map());
  useEffect(() => {
    const ch = supabase
      .channel('decisions-ch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'decisions' },
        (payload) => {
          const row = payload.new as Decision;
          setByTrain((prev) => {
            const next = new Map(prev);
            next.set(row.train_id, row);
            return next;
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'decisions' },
        (payload) => {
          const row = payload.new as Decision;
          setByTrain((prev) => {
            const cur = prev.get(row.train_id);
            if (cur && cur.id === row.id) {
              const next = new Map(prev);
              next.set(row.train_id, row);
              return next;
            }
            return prev;
          });
        },
      )
      .subscribe();
    supabase
      .from('decisions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, Decision>();
        for (const row of data as Decision[]) {
          if (!map.has(row.train_id)) map.set(row.train_id, row);
        }
        setByTrain(map);
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  return byTrain;
}

export function useIncidents(limit = 50): Incident[] {
  const [list, setList] = useState<Incident[]>([]);
  useEffect(() => {
    supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => data && setList(data as Incident[]));
    const ch = supabase
      .channel('incidents-ch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => setList((p) => [payload.new as Incident, ...p].slice(0, limit)),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          const row = payload.new as Incident;
          setList((p) => p.map((i) => (i.id === row.id ? row : i)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'incidents' },
        (payload) => {
          setList((p) => p.filter((i) => i.id !== payload.old.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [limit]);
  return list;
}

export function useWeather(): Weather | null {
  const [w, setW] = useState<Weather | null>(null);
  useEffect(() => {
    const fetchLatest = async () => {
      const { data } = await supabase
        .from('weather_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setW(data as Weather);
    };
    fetchLatest();
    const ch = supabase
      .channel('weather-ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_data' },
        () => fetchLatest(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  return w;
}
