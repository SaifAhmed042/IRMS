import { useEffect, useRef } from 'react';
import { CORRIDOR } from '../lib/corridor';
import type { Train, LiveLocation, Incident } from '../lib/types';

type LocByTrain = Map<string, LiveLocation>;

interface Props {
  trains: Train[];
  locations: LocByTrain;
  incidents: Incident[];
  highlightTrainId?: string;
}

export default function RailMap({ trains, locations, incidents, highlightTrainId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    const tryInit = () => {
      const L = window.L;
      if (!L || !ref.current || mapRef.current) return false;
      const map = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView(
        [23.5, 77.5],
        5,
      );
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Corridor polyline + station dots
      L.polyline(
        CORRIDOR.map((s) => [s.lat, s.lng]),
        { color: '#1E3A8A', weight: 3, opacity: 0.5, dashArray: '6 6' },
      ).addTo(map);
      CORRIDOR.forEach((s) => {
        L.circleMarker([s.lat, s.lng], {
          radius: 4,
          color: '#1E3A8A',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(s.name, { direction: 'top', offset: [0, -6] })
          .addTo(map);
      });

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      return true;
    };

    if (!tryInit()) {
      const id = setInterval(() => {
        if (tryInit()) clearInterval(id);
      }, 100);
      return () => clearInterval(id);
    }
  }, []);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    trains.forEach((t) => {
      const loc = locations.get(t.id);
      if (!loc) return;
      const isHi = highlightTrainId === t.id;
      const icon = L.divIcon({
        className: '',
        html: `<div class="train-marker ${t.train_type}" style="${isHi ? 'outline:3px solid #F59E0B; outline-offset:2px;' : ''}">${t.train_no.slice(-3)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const m = L.marker([loc.lat, loc.lng], { icon }).addTo(layer);
      m.bindTooltip(
        `<b>${t.train_no}</b> ${t.train_name}<br/>${t.train_type.toUpperCase()} • ${loc.speed} km/h`,
        { direction: 'top', offset: [0, -10] },
      );
    });

    incidents.forEach((i) => {
      const tone = i.severity === 'HIGH' ? '#EF4444' : i.severity === 'MEDIUM' ? '#F59E0B' : '#6B7280';
      L.circleMarker([i.lat, i.lng], {
        radius: 8,
        color: tone,
        fillColor: tone,
        fillOpacity: 0.6,
        weight: 2,
      })
        .bindTooltip(`Incident: ${i.type} (${i.severity})`, { direction: 'top' })
        .addTo(layer);
    });
  }, [trains, locations, incidents, highlightTrainId]);

  return <div ref={ref} className="w-full h-full rounded-xl overflow-hidden" />;
}
