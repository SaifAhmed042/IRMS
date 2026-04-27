export type TrainType = 'rajdhani' | 'express' | 'passenger' | 'goods';
export type ScheduleStatus = 'delayed' | 'on-time' | 'early';
export type ActionKind = 'PROCEED' | 'REDUCE' | 'STOP';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Train {
  id: string;
  train_no: string;
  train_name: string;
  train_type: TrainType;
  max_speed: number;
  schedule_status: ScheduleStatus;
}

export interface LiveLocation {
  id: string;
  train_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface Decision {
  id: string;
  train_id: string;
  recommended_speed: number;
  action: ActionKind;
  reason: string;
  ai_explanation: string;
  created_at: string;
}

export interface Incident {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: Severity;
  description: string;
  image_url: string;
  reporter_name: string;
  ai_alert: string;
  created_at: string;
}

export interface ScheduleStop {
  id: string;
  train_id: string;
  station_name: string;
  station_lat: number;
  station_lng: number;
  arrival_time: string | null;
  departure_time: string | null;
  stop_order: number;
}

export interface Weather {
  id: string;
  location: string;
  condition: string;
  severity: string;
  factor: number;
  created_at: string;
}
