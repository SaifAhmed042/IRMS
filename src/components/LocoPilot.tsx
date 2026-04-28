import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Gauge, AlertTriangle, CloudRain, Sparkles, MapPin, TrainFront } from 'lucide-react';
import { Card, Button, Pill, SectionTitle } from './ui';
import { supabase } from '../lib/supabase';
import { useTrains, useLatestLocations, useIncidents, useWeather, useSchedules } from '../hooks/useIRMSData';
import { computeDecision } from '../lib/decisionEngine';
import { explainDecision, geminiAvailable } from '../lib/gemini';
import { pointAlongCorridor, CORRIDOR } from '../lib/corridor';
import RailMap from './RailMap';
import type { Decision, Train } from '../lib/types';
import { useAuth } from '../hooks/useAuth';

const TICK_MS = 3000;

export default function LocoPilot() {
  const { session } = useAuth();
  const currentPilotId = session?.user?.id;
  const trains = useTrains();
  const locations = useLatestLocations();
  const incidents = useIncidents(20);
  const weather = useWeather();
  const schedules = useSchedules();

  const [trainId, setTrainId] = useState<string | null>(() => localStorage.getItem('irms_trainId'));
  const [tracking, setTracking] = useState(() => localStorage.getItem('irms_tracking') === 'true');

  useEffect(() => {
    if (trainId) localStorage.setItem('irms_trainId', trainId);
    else localStorage.removeItem('irms_trainId');
  }, [trainId]);

  useEffect(() => {
    if (tracking) localStorage.setItem('irms_tracking', 'true');
    else localStorage.removeItem('irms_tracking');
  }, [tracking]);
  const [progress, setProgress] = useState(0); 
  const [direction, setDirection] = useState(1); 
  const [latestDecision, setLatestDecision] = useState<Decision | null>(null);

  const train = useMemo(() => trains.find((t) => t.id === trainId) ?? null, [trains, trainId]);

  // Initialize train direction and progress from its schedule
  useEffect(() => {
    if (!train || tracking) return;
    const sched = schedules.get(train.id);
    if (sched && sched.length >= 2) {
      const isSouth = sched[0].station_lat > sched[1].station_lat;
      setDirection(isSouth ? 1 : -1);
      const startIdx = CORRIDOR.findIndex(s => s.name === sched[0].station_name);
      if (startIdx >= 0) {
        setProgress(startIdx / (CORRIDOR.length - 1));
      }
    }
  }, [train, schedules, tracking]);
  const [aiExplanation, setAiExplanation] = useState('');
  const progressRef = useRef(0);
  const lastAIKeyRef = useRef('');

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!tracking || !train) return;
    const tick = async () => {
      const next = progressRef.current + direction * 0.006;
      
      // Auto-remove train if destination reached
      if ((direction === 1 && next >= 1) || (direction === -1 && next <= 0)) {
        setTracking(false);
        setTrainId(null);
        await supabase.from('trains').update({ pilot_id: null }).eq('id', train.id);
        await supabase.from('trains').delete().eq('id', train.id);
        return;
      }

      const clamped = next > 1 ? 1 : next < 0 ? 0 : next;
      progressRef.current = clamped;
      setProgress(clamped);

      const pos = pointAlongCorridor(clamped);
      // Simulated current speed: 80% of recommended (or 70 if no decision)
      const baseSpeed = latestDecision?.recommended_speed ?? Math.round(train.max_speed * 0.7);
      const currentSpeed = Math.max(0, Math.round(baseSpeed * (0.85 + Math.random() * 0.2)));

      await supabase.from('live_locations').insert({
        train_id: train.id,
        lat: pos.lat,
        lng: pos.lng,
        speed: currentSpeed,
        heading: 180,
      });

      // Build decision context from current data
      const others = trains
        .filter((t) => t.id !== train.id)
        .map((t) => {
          const l = locations.get(t.id);
          if (!l) return null;
          return {
            train: t,
            position: { lat: l.lat, lng: l.lng },
            currentSpeed: l.speed,
            schedule: schedules.get(t.id),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const result = computeDecision({
        train,
        position: pos,
        currentSpeed,
        others,
        weather,
        incidents,
        schedule: schedules.get(train.id),
      });

      const { data: insertedRows } = await supabase
        .from('decisions')
        .insert({
          train_id: train.id,
          recommended_speed: result.recommended_speed,
          action: result.action,
          reason: result.reason,
          ai_explanation: '',
        })
        .select()
        .limit(1);

      const inserted = insertedRows?.[0] as Decision | undefined;
      if (inserted) setLatestDecision(inserted);

      // Trigger Gemini only when action/reason changes
      const aiKey = `${result.action}|${result.reason}`;
      if (geminiAvailable() && inserted && aiKey !== lastAIKeyRef.current) {
        lastAIKeyRef.current = aiKey;
        explainDecision({
          train_no: train.train_no,
          train_type: train.train_type,
          current_speed: currentSpeed,
          recommended_speed: result.recommended_speed,
          action: result.action,
          reason: result.reason,
          weather: weather?.condition ?? 'Normal',
          incident: incidents[0]?.type ?? 'None',
        }).then(async (text) => {
          if (!text) return;
          setAiExplanation(text);
          await supabase.from('decisions').update({ ai_explanation: text }).eq('id', inserted.id);
        });
      }
    };

    tick();
    
    // Use an inline Web Worker to bypass browser background-tab throttling (1-minute limit)
    const workerBlob = new Blob([`
      let timer = null;
      self.onmessage = function(e) {
        if (e.data.action === 'start') {
          timer = setInterval(() => self.postMessage('tick'), e.data.ms);
        } else if (e.data.action === 'stop') {
          clearInterval(timer);
        }
      };
    `], { type: 'application/javascript' });
    
    const worker = new Worker(URL.createObjectURL(workerBlob));
    worker.onmessage = () => tick();
    worker.postMessage({ action: 'start', ms: TICK_MS });

    return () => {
      worker.postMessage({ action: 'stop' });
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking, train?.id]);

  const myLoc = train ? locations.get(train.id) : undefined;
  const action = latestDecision?.action ?? 'PROCEED';
  const actionTextColor =
    action === 'PROCEED' ? 'text-emerald-300' : action === 'REDUCE' ? 'text-amber-300' : 'text-rose-300';

  const myLockedTrain = useMemo(() => trains.find(t => t.pilot_id === currentPilotId), [trains, currentPilotId]);

  const handleSelectTrain = async (t: Train) => {
    if (t.pilot_id && t.pilot_id !== currentPilotId) {
      alert("This train is already allocated to another locopilot!");
      return;
    }
    if (myLockedTrain && myLockedTrain.id !== t.id) {
      alert("You have already allocated another train. Cancel your current journey first.");
      return;
    }
    
    // Optimistically set UI, then lock in DB
    setTrainId(t.id);
    const { error } = await supabase
      .from('trains')
      .update({ pilot_id: currentPilotId })
      .eq('id', t.id);
      
    if (error) {
      alert("Could not allocate. Please try again.");
      setTrainId(null);
    }
  };

  if (!train) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-rail-700">Select your train</h2>
          <p className="text-sm text-slate-500 mt-1">
            Pick the train you are operating. Tracking will simulate GPS along the Delhi–Mumbai corridor.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {trains.map((t) => {
              const isMine = t.pilot_id === currentPilotId;
              const isTaken = !!t.pilot_id && !isMine;
              
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTrain(t)}
                  disabled={isTaken}
                  className={`text-left p-4 rounded-xl border transition ${
                    isTaken ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50' : 'border-slate-200 hover:border-rail-400 hover:bg-rail-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-rail-700">{t.train_no}</div>
                    {isTaken ? (
                      <Pill tone="rose">BLOCKED</Pill>
                    ) : isMine ? (
                      <Pill tone="emerald">YOURS</Pill>
                    ) : (
                      <Pill tone="blue">{t.train_type.toUpperCase()}</Pill>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{t.train_name}</div>
                  <div className="text-xs text-slate-400 mt-2">Max {t.max_speed} km/h · {t.schedule_status}</div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-7 space-y-5">
        <Card className="relative overflow-hidden text-white bg-gradient-to-br from-rail-500 to-rail-700 shadow-xl">
          <div className="absolute -top-4 opacity-10 animate-[pulse_12s_ease-in-out_infinite] translate-x-32">
            <TrainFront size={140} />
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-xl"></div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Train</div>
                <div className="text-3xl font-bold">{train.train_no}</div>
                <div className="text-sm opacity-90">{train.train_name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest opacity-80">Action</div>
                <div className={`text-3xl font-bold ${actionTextColor}`}>{action}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase opacity-80">Current</div>
                <div className="text-4xl font-bold font-mono">
                  {myLoc?.speed ?? 0}
                  <span className="text-base font-normal opacity-80 ml-1">km/h</span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase opacity-80">Recommended</div>
                <div className="text-4xl font-bold font-mono">
                  {latestDecision?.recommended_speed ?? '—'}
                  <span className="text-base font-normal opacity-80 ml-1">km/h</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Reason</SectionTitle>
          <p className="text-sm text-slate-700">
            {latestDecision?.reason ?? 'Awaiting first decision tick…'}
          </p>
          {(aiExplanation || latestDecision?.ai_explanation) && (
            <div className="mt-3 p-3 rounded-lg bg-rail-50 border border-rail-100">
              <div className="flex items-center gap-2 text-rail-600 text-xs font-semibold uppercase tracking-wide">
                <Sparkles size={14} /> Gemini Advisory
              </div>
              <p className="mt-1 text-sm text-rail-700">
                {aiExplanation || latestDecision?.ai_explanation}
              </p>
            </div>
          )}
          {!geminiAvailable() && (
            <p className="mt-3 text-[11px] text-slate-400">
              Set <code className="font-mono">VITE_GEMINI_API_KEY</code> to enable AI explanations.
            </p>
          )}
        </Card>

        <Card className="p-3 h-[320px]">
          <RailMap trains={trains} locations={locations} incidents={incidents} highlightTrainId={train.id} />
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-5 space-y-5">
        <Card className="p-5">
          <SectionTitle>Tracking</SectionTitle>
          {!tracking ? (
            <Button onClick={() => setTracking(true)} className="w-full">
              <Play size={16} /> Start Tracking
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setTracking(false)} className="w-full">
              <Square size={16} /> Stop Tracking
            </Button>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-[11px] text-slate-500 uppercase">Position</div>
              <div className="font-mono text-xs mt-1">
                {myLoc ? `${myLoc.lat.toFixed(3)}, ${myLoc.lng.toFixed(3)}` : '—'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-[11px] text-slate-500 uppercase">Corridor Progress</div>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rail-500 transition-all"
                  style={{ width: `${(progress * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              setTracking(false);
              setTrainId(null);
              if (train) {
                await supabase.from('trains').update({ pilot_id: null }).eq('id', train.id);
              }
            }}
            className="mt-4 text-xs text-slate-500 hover:text-rail-500"
          >
            ← Cancel Journey
          </button>
        </Card>

        <Card className="p-5">
          <SectionTitle>Environment</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
                <CloudRain size={14} /> Weather
              </div>
              <div className="mt-1 text-base font-bold text-rail-700">{weather?.condition ?? 'Normal'}</div>
              <div className="text-[11px] text-slate-500">factor {(weather?.factor ?? 1).toFixed(2)}×</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
                <AlertTriangle size={14} /> Incidents
              </div>
              <div className="mt-1 text-base font-bold text-rail-700">{incidents.length}</div>
              <div className="text-[11px] text-slate-500">
                {incidents.filter((i) => i.severity === 'HIGH').length} high severity
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Nearby Alerts</SectionTitle>
          {incidents.length === 0 && (
            <div className="text-xs text-slate-400 py-4 text-center">No active alerts.</div>
          )}
          <div className="space-y-2 max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
            {incidents.slice(0, 5).map((i) => (
              <div key={i.id} className="flex items-start gap-2 p-2 rounded-lg border border-slate-100">
                <div className="mt-0.5">
                  <MapPin size={14} className="text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Pill tone={i.severity === 'HIGH' ? 'rose' : i.severity === 'MEDIUM' ? 'amber' : 'slate'}>
                      {i.severity}
                    </Pill>
                    <span className="text-xs font-semibold">{i.type}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {i.ai_alert || i.description || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* sentinels for unused warnings */}
      <Gauge className="hidden" />
    </div>
  );
}
