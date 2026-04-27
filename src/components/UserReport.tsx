import { useEffect, useState } from 'react';
import { Camera, Upload, MapPin, Send, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Card, Button, SectionTitle, Pill } from './ui';
import { supabase } from '../lib/supabase';
import { extractIncidentData, smartAlertText, geminiAvailable } from '../lib/gemini';
import { useIncidents } from '../hooks/useIRMSData';
import { pointAlongCorridor } from '../lib/corridor';
import type { Severity } from '../lib/types';

function fileToBase64(file: File): Promise<{ base64: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve({ base64, mime: file.type || 'image/jpeg', dataUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UserReport() {
  const incidents = useIncidents(8);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState('unknown');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [image, setImage] = useState<{ base64: string; mime: string; dataUrl: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ type: string; alert: string } | null>(null);

  useEffect(() => {
    // Fallback: random point along the demo corridor
    setCoords(pointAlongCorridor(Math.random()));
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 4000 },
      );
    }
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = await fileToBase64(f);
    setImage(r);

    if (geminiAvailable()) {
      setAnalyzing(true);
      const data = await extractIncidentData(r.base64, r.mime);
      if (data) {
        setIssueType(data.type);
        setDescription(data.description);
        setSeverity(data.severity as Severity);
      }
      setAnalyzing(false);
    }
  }

  async function submit() {
    if (!coords) return;
    setSubmitting(true);
    let alertText = '';

    if (geminiAvailable()) {
      alertText = await smartAlertText({
        type: issueType,
        severity,
        description: description || issueType,
      });
    }

    await supabase.from('incidents').insert({
      lat: coords.lat,
      lng: coords.lng,
      type: issueType,
      severity,
      description,
      reporter_name: name,
      image_url: image?.dataUrl ?? '',
      ai_alert: alertText,
    });

    setSubmitting(false);
    setDone({ type: issueType, alert: alertText });
    setImage(null);
    setDescription('');
    setIssueType('unknown');
  }

  return (
    <div className="max-w-5xl mx-auto p-6 grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-7">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-rail-700">Report a track incident</h2>
              <p className="text-sm text-slate-500 mt-1">
                Your report is broadcast in real time to nearby trains and the station manager.
              </p>
            </div>
          </div>

          {done ? (
            <div className="mt-6 p-5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 size={18} /> Incident submitted
              </div>
              <div className="mt-2 text-sm text-emerald-800">
                Classified as <b className="capitalize">{done.type}</b>
                {done.alert && <div className="mt-2 italic">"{done.alert}"</div>}
              </div>
              <Button className="mt-4" variant="outline" onClick={() => setDone(null)}>
                Submit another
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Your name (optional)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rail-300"
                  placeholder="e.g. R. Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Issue Type</label>
                <input
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rail-300 capitalize"
                  placeholder="e.g. Obstruction"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rail-300"
                  placeholder="What did you see?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Severity</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as Severity[]).map((s) => {
                    const tone = s === 'HIGH' ? 'border-rose-400 bg-rose-50 text-rose-700' :
                                 s === 'MEDIUM' ? 'border-amber-400 bg-amber-50 text-amber-700' :
                                 'border-slate-300 bg-slate-50 text-slate-700';
                    const active = severity === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                          active ? tone : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Photo</label>
                {!image ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col items-center justify-center gap-3 px-4 py-6 rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:border-rail-400 hover:bg-rail-50/30 transition">
                      <Camera size={24} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-600">Take Photo</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-3 px-4 py-6 rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:border-rail-400 hover:bg-rail-50/30 transition">
                      <Upload size={24} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-600">Upload Image</span>
                      <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-300 cursor-pointer hover:border-rail-400 hover:bg-rail-50/30 transition">
                    <Camera size={16} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-600">Change photo</span>
                    <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  </label>
                )}
                {analyzing && <div className="mt-2 text-xs text-rail-500 animate-pulse flex items-center gap-1"><Sparkles size={12}/> AI is analyzing image and auto-filling form...</div>}
                {image && !analyzing && (
                  <img src={image.dataUrl} alt="" className="mt-3 rounded-lg w-full max-h-56 object-cover" />
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin size={14} className="text-rail-500" />
                {coords ? (
                  <>
                    Location captured: <span className="font-mono">{coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}</span>
                  </>
                ) : (
                  'Capturing location…'
                )}
              </div>

              <Button onClick={submit} disabled={submitting || !coords} className="w-full">
                <Send size={16} /> {submitting ? 'Submitting…' : 'Submit Report'}
              </Button>
              {!geminiAvailable() && (
                <p className="text-[11px] text-slate-400">
                  Add <code className="font-mono">VITE_GEMINI_API_KEY</code> to enable AI image classification.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-5 space-y-5">
        <Card className="p-5">
          <SectionTitle hint="updates live">Recent Reports</SectionTitle>
          {incidents.length === 0 && (
            <div className="text-xs text-slate-400 py-6 text-center">No reports yet.</div>
          )}
          <div className="space-y-3">
            {incidents.map((i) => (
              <div key={i.id} className="flex gap-3">
                {i.image_url ? (
                  <img src={i.image_url} className="w-14 h-14 rounded object-cover" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                    <AlertTriangle size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Pill tone={i.severity === 'HIGH' ? 'rose' : i.severity === 'MEDIUM' ? 'amber' : 'slate'}>
                      {i.severity}
                    </Pill>
                    <span className="text-xs font-semibold capitalize">{i.type}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {i.ai_alert || i.description || '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(i.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-rail-500 to-rail-700 text-white">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
            <Sparkles size={14} /> AI-Assisted Reporting
          </div>
          <p className="mt-2 text-sm leading-relaxed opacity-95">
            Photos are classified by Gemini Vision into obstruction, damage, animal, flood, or unknown.
            A short safety advisory is generated for nearby loco pilots automatically.
          </p>
        </Card>
      </div>
    </div>
  );
}
