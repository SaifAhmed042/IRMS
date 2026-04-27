export interface Station {
  name: string;
  lat: number;
  lng: number;
}

export const CORRIDOR: Station[] = [
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Mathura',   lat: 27.4924, lng: 77.6737 },
  { name: 'Agra',      lat: 27.1767, lng: 78.0081 },
  { name: 'Gwalior',   lat: 26.2183, lng: 78.1828 },
  { name: 'Jhansi',    lat: 25.4484, lng: 78.5685 },
  { name: 'Bhopal',    lat: 23.2599, lng: 77.4126 },
  { name: 'Itarsi',    lat: 22.6131, lng: 77.7626 },
  { name: 'Nagpur',    lat: 21.1458, lng: 79.0882 },
  { name: 'Nashik',    lat: 19.9975, lng: 73.7898 },
  { name: 'Mumbai',    lat: 19.0760, lng: 72.8777 },
];

export function pointAlongCorridor(t: number): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(1, t));
  const totalSegs = CORRIDOR.length - 1;
  const pos = clamped * totalSegs;
  const i = Math.min(Math.floor(pos), totalSegs - 1);
  const f = pos - i;
  const a = CORRIDOR[i];
  const b = CORRIDOR[i + 1];
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}
