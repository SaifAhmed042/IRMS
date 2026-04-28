import type { ActionKind, Decision, Incident, ScheduleStop, Train, Weather } from './types';
import { haversineKm } from './geo';

const TYPE_PRIORITY: Record<Train['train_type'], number> = {
  rajdhani: 100,
  express: 80,
  passenger: 60,
  goods: 40,
};

const SCHEDULE_PRIORITY: Record<Train['schedule_status'], number> = {
  delayed: 40,
  'on-time': 20,
  early: 10,
};

export function priorityScore(train: Train): number {
  return TYPE_PRIORITY[train.train_type] + SCHEDULE_PRIORITY[train.schedule_status];
}

export interface DecisionContext {
  train: Train;
  position: { lat: number; lng: number };
  currentSpeed: number;
  direction: number;
  others: {
    train: Train;
    position: { lat: number; lng: number };
    currentSpeed?: number;
    schedule?: ScheduleStop[];
    timestamp?: string;
  }[];
  weather: Weather | null;
  incidents: Incident[];
  schedule?: ScheduleStop[];
}

export interface DecisionResult {
  recommended_speed: number;
  action: ActionKind;
  reason: string;
  conflictTrainNo?: string;
  nearestIncidentKm?: number;
  stationClash?: { station: string; otherTrainNo: string; minutesApart: number };
}

const SAME_STATION_WINDOW_MIN = 10;
const STATION_LOOKAHEAD_KM = 60;

function nextStop(
  schedule: ScheduleStop[] | undefined,
  position: { lat: number; lng: number },
): { stop: ScheduleStop; km: number } | null {
  if (!schedule || schedule.length === 0) return null;
  const ranked = schedule
    .map((s) => ({ stop: s, km: haversineKm(position, { lat: s.station_lat, lng: s.station_lng }) }))
    .sort((a, b) => a.km - b.km);
  const closest = ranked[0];
  if (!closest) return null;
  // Prefer a stop that is "ahead" — has a higher stop_order than another stop closer behind.
  const ahead = schedule
    .filter((s) => {
      const arrTime = s.arrival_time ? new Date(s.arrival_time).getTime() : 0;
      return arrTime === 0 || arrTime >= Date.now() - 5 * 60_000;
    })
    .map((s) => ({ stop: s, km: haversineKm(position, { lat: s.station_lat, lng: s.station_lng }) }))
    .sort((a, b) => a.km - b.km)[0];
  return ahead ?? closest;
}

function etaMinutes(km: number, speedKmh: number): number {
  if (speedKmh <= 5) return Number.POSITIVE_INFINITY;
  return (km / speedKmh) * 60;
}

const CONFLICT_RADIUS_KM = 30;
const HEAD_ON_RADIUS_KM = 20;
const INCIDENT_RADIUS_KM = 8;

export function computeDecision(ctx: DecisionContext): DecisionResult {
  const { train, position, others, weather, incidents } = ctx;
  const baseMax = train.max_speed;
  const factor = weather?.factor ?? 1.0;

  // 1. Highest priority: HIGH severity incident in path
  const highIncidents = incidents
    .filter((i) => i.severity === 'HIGH')
    .map((i) => ({ i, km: haversineKm(position, { lat: i.lat, lng: i.lng }) }))
    .filter((x) => x.km <= INCIDENT_RADIUS_KM)
    .sort((a, b) => a.km - b.km);

  if (highIncidents.length > 0) {
    const km = highIncidents[0].km;
    return {
      recommended_speed: 0,
      action: 'STOP',
      reason: `HIGH severity incident ${km.toFixed(1)} km ahead — full stop required`,
      nearestIncidentKm: km,
    };
  }

  const mediumIncidents = incidents
    .filter((i) => i.severity === 'MEDIUM')
    .map((i) => ({ i, km: haversineKm(position, { lat: i.lat, lng: i.lng }) }))
    .filter((x) => x.km <= INCIDENT_RADIUS_KM)
    .sort((a, b) => a.km - b.km);

  // 2. Conflict detection
  const myScore = priorityScore(train);
  
  const aheadTrains = others
    .map((o) => {
      const isSouth = o.schedule && o.schedule.length >= 2 ? o.schedule[0].station_lat > o.schedule[1].station_lat : undefined;
      const otherDirection = isSouth === true ? 1 : isSouth === false ? -1 : undefined;
      return { ...o, km: haversineKm(position, o.position), otherDirection };
    })
    .filter((o) => {
      if (ctx.direction === 1) return o.position.lat < position.lat; // Going south
      return o.position.lat > position.lat; // Going north
    })
    .sort((a, b) => a.km - b.km);

  // Check for head-on conflicts first (opposite directions)
  const headOn = aheadTrains.find((o) => o.otherDirection !== undefined && o.otherDirection !== ctx.direction && o.km <= HEAD_ON_RADIUS_KM);

  if (headOn) {
    const otherScore = priorityScore(headOn.train);
    // If lower priority (or tie and going North), yield and stop.
    if (otherScore > myScore || (otherScore === myScore && ctx.direction === -1)) {
      return {
        recommended_speed: 0,
        action: 'STOP',
        reason: `Head-on conflict with higher priority train ${headOn.train.train_no} approaching ${headOn.km.toFixed(1)} km ahead. Halt to yield.`,
        conflictTrainNo: headOn.train.train_no,
      };
    } else {
      return {
        recommended_speed: Math.round(baseMax * 1.0 * factor),
        action: 'PROCEED',
        reason: `Head-on conflict with lower priority train ${headOn.train.train_no} (${headOn.km.toFixed(1)} km ahead). Priority granted, maintain speed.`,
        conflictTrainNo: headOn.train.train_no,
      };
    }
  }

  // Same-direction conflicts
  const conflicts = aheadTrains.filter((o) => o.otherDirection === ctx.direction && o.km <= CONFLICT_RADIUS_KM);

  // Check for halted trains ahead
  const haltedTrain = conflicts.find((o) => {
    const isStale = o.timestamp ? Date.now() - new Date(o.timestamp).getTime() > 15000 : false;
    return o.currentSpeed === 0 || isStale;
  });

  if (haltedTrain) {
    if (haltedTrain.km <= 2.0) {
      return {
        recommended_speed: 0,
        action: 'STOP',
        reason: `Train ${haltedTrain.train.train_no} is halted ${haltedTrain.km.toFixed(1)} km ahead. Holding position until track clears.`,
        conflictTrainNo: haltedTrain.train.train_no,
      };
    } else {
      // Dynamic braking: gradually reduce speed as we approach the halted train
      const distanceFactor = Math.max(0.1, (haltedTrain.km - 2.0) / (CONFLICT_RADIUS_KM - 2.0));
      return {
        recommended_speed: Math.max(10, Math.round(baseMax * distanceFactor * factor)),
        action: 'REDUCE',
        reason: `Train ${haltedTrain.train.train_no} is halted ${haltedTrain.km.toFixed(1)} km ahead. Applying dynamic brakes to prepare for halt.`,
        conflictTrainNo: haltedTrain.train.train_no,
      };
    }
  }

  let action: ActionKind = 'PROCEED';
  let reason = 'Track clear, proceed at recommended cruising speed';
  let recommended = Math.round(baseMax * factor);
  let conflictNo: string | undefined;

  if (mediumIncidents.length > 0) {
    const km = mediumIncidents[0].km;
    action = 'REDUCE';
    recommended = Math.round(baseMax * 0.5 * factor);
    reason = `Incident reported ${km.toFixed(1)} km ahead — reduce speed and stay alert`;
  }

  if (conflicts.length > 0) {
    const closest = conflicts[0];
    const otherScore = priorityScore(closest.train);
    conflictNo = closest.train.train_no;
    if (otherScore > myScore) {
      action = 'REDUCE';
      recommended = Math.round(baseMax * 0.45 * factor);
      reason = `Higher priority train ${closest.train.train_no} (${closest.train.train_name}) ${closest.km.toFixed(1)} km ahead — reduce speed to allow clearance`;
    } else if (otherScore === myScore) {
      action = 'REDUCE';
      recommended = Math.round(baseMax * 0.7 * factor);
      reason = `Equal-priority train ${closest.train.train_no} ${closest.km.toFixed(1)} km away — caution advised`;
    } else {
      reason = `Lower priority train ${closest.train.train_no} ${closest.km.toFixed(1)} km away — maintain priority pass`;
    }
  }

  // 3. Station-arrival clash: compare scheduled / ETA arrival at next station.
  let stationClash: DecisionResult['stationClash'];
  const myNext = nextStop(ctx.schedule, position);
  if (myNext && myNext.km <= STATION_LOOKAHEAD_KM) {
    const myEta = etaMinutes(myNext.km, ctx.currentSpeed || recommended || 1);
    const myArrivalMs = myNext.stop.arrival_time
      ? new Date(myNext.stop.arrival_time).getTime()
      : Date.now() + myEta * 60_000;

    for (const o of others) {
      if (!o.schedule) continue;
      const theirStop = o.schedule.find((s) => s.station_name === myNext.stop.station_name);
      if (!theirStop) continue;
      const theirKm = haversineKm(o.position, { lat: theirStop.station_lat, lng: theirStop.station_lng });
      if (theirKm > STATION_LOOKAHEAD_KM) continue;

      const theirSpeed = o.currentSpeed ?? Math.round(o.train.max_speed * 0.7);
      const theirEta = etaMinutes(theirKm, theirSpeed || 1);
      const theirArrivalMs = theirStop.arrival_time
        ? new Date(theirStop.arrival_time).getTime()
        : Date.now() + theirEta * 60_000;

      const minutesApart = Math.abs(myArrivalMs - theirArrivalMs) / 60_000;
      if (minutesApart > SAME_STATION_WINDOW_MIN) continue;

      const otherScore = priorityScore(o.train);
      stationClash = {
        station: myNext.stop.station_name,
        otherTrainNo: o.train.train_no,
        minutesApart: Math.round(minutesApart),
      };

      if (otherScore > myScore) {
        action = 'REDUCE';
        recommended = Math.min(recommended, Math.round(baseMax * 0.4 * factor));
        reason = `Schedule clash at ${myNext.stop.station_name}: higher-priority ${o.train.train_name} (${o.train.train_no}) arrives within ${stationClash.minutesApart} min — reduce speed and yield.`;
        conflictNo = o.train.train_no;
      } else if (otherScore < myScore) {
        reason = `Schedule clash at ${myNext.stop.station_name} with ${o.train.train_name} (${o.train.train_no}) — you have priority, hold cruising speed.`;
        conflictNo = o.train.train_no;
      } else {
        action = action === 'PROCEED' ? 'REDUCE' : action;
        recommended = Math.min(recommended, Math.round(baseMax * 0.65 * factor));
        reason = `Schedule clash at ${myNext.stop.station_name} with equal-priority ${o.train.train_no} — caution, reduce speed.`;
        conflictNo = o.train.train_no;
      }
      break;
    }
  }

  if (factor < 1 && action === 'PROCEED') {
    reason = `${weather?.condition ?? 'Weather'} conditions — speed reduced by safety factor ${(factor * 100).toFixed(0)}%`;
    action = 'REDUCE';
  }

  if (recommended <= 5) {
    action = 'STOP';
    recommended = 0;
  }

  return {
    recommended_speed: recommended,
    action,
    reason,
    conflictTrainNo: conflictNo,
    stationClash,
  };
}

export function decisionToBadge(d: Pick<Decision, 'action'>): string {
  switch (d.action) {
    case 'PROCEED': return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
    case 'REDUCE':  return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    case 'STOP':    return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
  }
}
