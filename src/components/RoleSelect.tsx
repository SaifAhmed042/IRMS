import { TrainFront, Radio, AlertTriangle, ArrowRight } from 'lucide-react';

type Role = 'manager' | 'locopilot' | 'user';

const OPTIONS: { role: Role; title: string; desc: string; icon: any; tone: string }[] = [
  {
    role: 'manager',
    title: 'Station Manager',
    desc: 'Live network map, conflicts, alerts, and weather across the corridor.',
    icon: Radio,
    tone: 'from-rail-500 to-rail-700',
  },
  {
    role: 'locopilot',
    title: 'Loco Pilot',
    desc: 'Stream GPS, receive recommended speed and AI-powered safety advisories.',
    icon: TrainFront,
    tone: 'from-emerald-500 to-emerald-700',
  },
  {
    role: 'user',
    title: 'Public Reporter',
    desc: 'Report a track incident with image, location, and severity for the network.',
    icon: AlertTriangle,
    tone: 'from-amber-500 to-amber-600',
  },
];

export default function RoleSelect({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rail-50/40 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rail-50 text-rail-700 text-xs font-semibold mb-4 ring-1 ring-rail-100">
            HYBRID AI · DETERMINISTIC + GEMINI
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-rail-700 tracking-tight">
            Intelligent Rail Management System
          </h1>
          <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
            Mobile-based real-time tracking, conflict-aware decisioning, and AI advisories — without
            new trackside infrastructure.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {OPTIONS.map(({ role, title, desc, icon: Icon, tone }) => (
            <button
              key={role}
              onClick={() => onPick(role)}
              className="group relative text-left bg-white rounded-2xl border border-slate-200 hover:border-rail-300 hover:shadow-lg transition-all p-6 overflow-hidden"
            >
              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full bg-gradient-to-br ${tone} opacity-10 group-hover:opacity-20 transition`}></div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-soft`}>
                <Icon size={22} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-rail-700">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
              <div className="mt-5 inline-flex items-center text-sm font-semibold text-rail-500 group-hover:gap-2 gap-1 transition-all">
                Continue <ArrowRight size={16} />
              </div>
            </button>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Demo data: Delhi–Mumbai corridor. Connect Gemini API for AI explanations.
        </p>
      </div>
    </div>
  );
}
