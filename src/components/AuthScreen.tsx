import { useState } from 'react';
import { TrainFront, Radio, AlertTriangle, ArrowRight, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { signIn, signUp, type AppRole } from '../hooks/useAuth';

const ROLE_OPTIONS: { role: AppRole; title: string; desc: string; icon: any; tone: string }[] = [
  {
    role: 'manager',
    title: 'Station Manager',
    desc: 'Live network map, conflicts, alerts and weather across the corridor.',
    icon: Radio,
    tone: 'from-rail-500 to-rail-700',
  },
  {
    role: 'locopilot',
    title: 'Loco Pilot',
    desc: 'Stream GPS, receive recommended speeds and AI advisories.',
    icon: TrainFront,
    tone: 'from-emerald-500 to-emerald-700',
  },
  {
    role: 'user',
    title: 'Public Reporter',
    desc: 'Report a track incident with image, location and severity.',
    icon: AlertTriangle,
    tone: 'from-amber-500 to-amber-600',
  },
];

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<AppRole>('manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUp({ email: email.trim(), password, fullName: fullName.trim(), role });
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rail-50/40 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rail-50 text-rail-700 text-xs font-semibold mb-4 ring-1 ring-rail-100">
            HYBRID AI · DETERMINISTIC + GEMINI
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-rail-700 tracking-tight">
            Intelligent Rail Management System
          </h1>
          <p className="mt-4 text-slate-600 max-w-xl leading-relaxed">
            Mobile-based real-time tracking, schedule-aware conflict resolution and AI advisories — sign in
            with the role you operate as.
          </p>

          {mode === 'signup' && (
            <div className="mt-8 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Choose your role
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {ROLE_OPTIONS.map(({ role: r, title, icon: Icon, tone }) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`text-left p-4 rounded-xl border transition ${
                      role === r
                        ? 'border-rail-400 bg-rail-50/60 ring-2 ring-rail-200'
                        : 'border-slate-200 hover:border-rail-300 bg-white'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-soft`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="mt-3 text-sm font-bold text-rail-700">{title}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {ROLE_OPTIONS.find((o) => o.role === role)?.desc}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-rail-700">
                  {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {mode === 'signin'
                    ? 'Use your registered email and password.'
                    : 'You will be routed to your role workspace.'}
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {mode === 'signup' && (
                <Field icon={UserIcon} label="Full name">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm py-2"
                    placeholder="Aarav Sharma"
                  />
                </Field>
              )}

              <Field icon={Mail} label="Email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm py-2"
                  placeholder="you@railways.in"
                />
              </Field>

              <Field icon={Lock} label="Password">
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm py-2"
                  placeholder="••••••••"
                />
              </Field>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 bg-rail-600 hover:bg-rail-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-slate-500">
              {mode === 'signin' ? (
                <>
                  New to IRMS?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                    }}
                    className="text-rail-600 font-semibold hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                    }}
                    className="text-rail-600 font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Email confirmation is disabled — sign-up grants instant access.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2 px-3 rounded-lg border border-slate-200 focus-within:border-rail-400 focus-within:ring-2 focus-within:ring-rail-100 transition">
        <Icon size={16} className="text-slate-400" />
        {children}
      </div>
    </label>
  );
}
