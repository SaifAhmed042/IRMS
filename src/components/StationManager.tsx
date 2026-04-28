import { useMemo } from 'react';
import {
  AlertTriangle,
  CloudRain,
  Cloud,
  Sun,
  TrendingDown,
  TrendingUp,
  Pause,
  Play,
  Gauge,
  Trash2,
} from 'lucide-react';
import { Card, Pill, SectionTitle, StatTile, Button } from './ui';
import RailMap from './RailMap';
import { motion } from 'framer-motion';
import {
  useTrains,
  useLatestLocations,
  useLatestDecisions,
  useIncidents,
  useWeather,
  useSchedules,
} from '../hooks/useIRMSData';
import { decisionToBadge } from '../lib/decisionEngine';
import { supabase } from '../lib/supabase';

const WEATHER_PRESETS = [
  { condition: 'Normal', severity: 'LOW',    factor: 1.0, icon: Sun },
  { condition: 'Rain',   severity: 'MEDIUM', factor: 0.7, icon: CloudRain },
  { condition: 'Fog',    severity: 'HIGH',   factor: 0.5, icon: Cloud },
];

export default function StationManager() {
  const trains = useTrains();
  const locations = useLatestLocations();
  const decisions = useLatestDecisions();
  const incidents = useIncidents(20);
  const weather = useWeather();
  const schedules = useSchedules();

  const activeTrains = useMemo(
    () => trains.filter((t) => locations.has(t.id)),
    [trains, locations],
  );

  const stats = useMemo(() => {
    let proceed = 0, reduce = 0, stop = 0;
    activeTrains.forEach((t) => {
      const loc = locations.get(t.id);
      const dec = decisions.get(t.id);
      
      if (loc?.speed === 0) {
        stop++;
      } else if (dec?.action === 'REDUCE') {
        reduce++;
      } else {
        proceed++;
      }
    });
    return { proceed, reduce, stop };
  }, [activeTrains, locations, decisions]);

  async function setWeather(p: (typeof WEATHER_PRESETS)[number]) {
    await supabase.from('weather_data').insert({
      location: 'corridor',
      condition: p.condition,
      severity: p.severity,
      factor: p.factor,
    });
  }

  async function deleteIncident(id: string) {
    await supabase.from('incidents').delete().eq('id', id);
  }

  const WIcon = weather?.condition === 'Rain' ? CloudRain : weather?.condition === 'Fog' ? Cloud : Sun;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5 }}
      className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-5"
    >
      <div className="col-span-12 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="relative">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute inset-0 bg-blue-400 rounded-2xl -z-10"
          />
          <StatTile label="Active Trains" value={activeTrains.length} sub={`${trains.length} in roster`} tone="blue" />
        </div>
        <StatTile label="Proceeding" value={stats.proceed} tone="emerald" />
        <StatTile label="Reducing" value={stats.reduce} tone="amber" />
        <StatTile label="Stopped" value={stats.stop} tone="rose" />
        <StatTile
          label="Open Incidents"
          value={incidents.length}
          sub={incidents.filter((i) => i.severity === 'HIGH').length + ' high severity'}
          tone="rose"
        />
      </div>

      <div className="col-span-12 lg:col-span-8 h-[560px]">
        <Card className="h-full p-3">
          <RailMap trains={trains} locations={locations} incidents={incidents} />
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-5">
        <Card className="p-5">
          <SectionTitle hint={weather && <>updated {new Date(weather.created_at).toLocaleTimeString()}</>}>
            Weather
          </SectionTitle>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-rail-50 text-rail-600 flex items-center justify-center">
              <WIcon size={28} />
            </div>
            <div>
              <div className="text-2xl font-bold text-rail-700">{weather?.condition ?? 'Normal'}</div>
              <div className="text-xs text-slate-500">
                Speed factor <span className="font-mono font-semibold">{(weather?.factor ?? 1).toFixed(2)}×</span>
                {' · '}severity {weather?.severity ?? 'LOW'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {WEATHER_PRESETS.map((p) => {
              const Icon = p.icon;
              const active = weather?.condition === p.condition;
              return (
                <button
                  key={p.condition}
                  onClick={() => setWeather(p)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold transition ${
                    active
                      ? 'border-rail-500 bg-rail-50 text-rail-700'
                      : 'border-slate-200 text-slate-600 hover:border-rail-300'
                  }`}
                >
                  <Icon size={18} />
                  {p.condition}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle hint={`${incidents.length} total`}>Incident Feed</SectionTitle>
          <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
            {incidents.length === 0 && (
              <div className="text-xs text-slate-400 py-4 text-center">No incidents reported.</div>
            )}
            {incidents.map((i) => {
              const tone = i.severity === 'HIGH' ? 'rose' : i.severity === 'MEDIUM' ? 'amber' : 'slate';
              return (
                <div key={i.id} className="flex gap-3 p-2 rounded-lg hover:bg-slate-50">
                  {i.image_url ? (
                    <img src={i.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                      <AlertTriangle size={18} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Pill tone={tone}>{i.severity}</Pill>
                      <span className="text-xs font-semibold text-slate-700 truncate">{i.type}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {i.ai_alert || i.description || `${i.lat.toFixed(2)}, ${i.lng.toFixed(2)}`}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(i.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteIncident(i.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors self-start"
                    title="Resolve Incident"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="col-span-12">
        <Card className="p-5">
          <SectionTitle hint="Live decisions">Train Operations</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2">Train</th>
                  <th>Route & Location</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="text-right">Speed</th>
                  <th className="text-right">Recommended</th>
                  <th>Action</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {trains.map((t) => {
                  const loc = locations.get(t.id);
                  const dec = decisions.get(t.id);
                  const sched = schedules.get(t.id) || [];
                  const src = sched.length > 0 ? sched[0].station_name : 'N/A';
                  const dst = sched.length > 0 ? sched[sched.length - 1].station_name : 'N/A';
                  let passedStation = '—';
                  if (loc && sched.length > 0) {
                    const ranked = [...sched].sort((a,b) => {
                       const distA = Math.hypot(loc.lat - a.station_lat, loc.lng - a.station_lng);
                       const distB = Math.hypot(loc.lat - b.station_lat, loc.lng - b.station_lng);
                       return distA - distB;
                    });
                    if (ranked.length > 0) passedStation = `Passed near ${ranked[0].station_name}`;
                  }

                  return (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3">
                        <div className="font-bold text-rail-700">{t.train_no}</div>
                        <div className="text-xs text-slate-500">{t.train_name}</div>
                      </td>
                      <td>
                        <div className="text-xs font-semibold text-slate-700">{src} → {dst}</div>
                        <div className="text-[11px] text-slate-500">{passedStation}</div>
                      </td>
                      <td>
                        <Pill tone="blue">{t.train_type.toUpperCase()}</Pill>
                      </td>
                      <td>
                        {t.schedule_status === 'delayed' && (
                          <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-semibold">
                            <TrendingDown size={12} /> Delayed
                          </span>
                        )}
                        {t.schedule_status === 'on-time' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                            <Play size={12} /> On time
                          </span>
                        )}
                        {t.schedule_status === 'early' && (
                          <span className="inline-flex items-center gap-1 text-rail-500 text-xs font-semibold">
                            <TrendingUp size={12} /> Early
                          </span>
                        )}
                      </td>
                      <td className="text-right font-mono font-semibold">
                        {loc ? `${loc.speed} km/h` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-right font-mono font-semibold text-rail-700">
                        {dec ? `${dec.recommended_speed} km/h` : <span className="text-slate-300">—</span>}
                      </td>
                      <td>
                        {dec ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${decisionToBadge(dec)}`}>
                            {dec.action === 'STOP' && <Pause size={10} className="inline mr-1" />}
                            {dec.action === 'PROCEED' && <Gauge size={10} className="inline mr-1" />}
                            {dec.action}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">offline</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-600 max-w-[420px]">
                        {dec?.ai_explanation || dec?.reason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-slate-400 mt-4">
            Tip: Use the Loco Pilot view (in another tab/device) to start tracking, or the demo mode below.
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={async () => {
              // Quick demo: clear stale data
              await supabase.from('live_locations').delete().not('id', 'is', null);
              await supabase.from('decisions').delete().not('id', 'is', null);
            }}>
              Reset Live Data
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
