import { useState } from 'react';
import { TrainFront, Radio, AlertTriangle, ArrowRight, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const BACKGROUNDS = {
  signin: 'https://images.indianexpress.com/2026/02/railways-3.jpg',
  signup: {
    manager: 'https://c7.alamy.com/comp/2C6PCGR/train-station-manager-sign-at-darjeeling-india-2C6PCGR.jpg', // Control room feel
    locopilot: 'https://pbs.twimg.com/media/GxuZ7svWcAAQoEK.jpg', // Train cabin feel
    user: 'https://static.vecteezy.com/system/resources/thumbnails/053/747/059/small/railway-tracks-stretching-through-a-green-field-and-mountains-under-a-clear-sky-photo.jpeg', // Tracks / Public
  }
};

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

  const bgImage = mode === 'signin' ? BACKGROUNDS.signin : BACKGROUNDS.signup[role];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      {/* Animated Background Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={bgImage}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-slate-900/50 z-10" />

      <div className="w-full max-w-5xl grid lg:grid-cols-12 gap-8 items-center relative z-20">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white backdrop-blur-md text-xs font-semibold mb-4 ring-1 ring-white/30 shadow-lg">
            HYBRID AI · DETERMINISTIC + GEMINI
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
            Intelligent Rail Management System
          </h1>
          <p className="mt-4 text-slate-200 max-w-xl leading-relaxed drop-shadow-md">
            Mobile-based real-time tracking, schedule-aware conflict resolution and AI advisories — sign in
            with the role you operate as.
          </p>

          {mode === 'signup' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 space-y-3"
            >
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wide drop-shadow-sm">
                Choose your role
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {ROLE_OPTIONS.map(({ role: r, title, icon: Icon, tone }) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`text-left p-4 rounded-xl border transition backdrop-blur-md ${
                      role === r
                        ? 'border-white/50 bg-white/20 ring-2 ring-white/50 shadow-lg'
                        : 'border-white/10 bg-black/20 hover:bg-black/40 hover:border-white/30'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-lg`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className={`mt-3 text-sm font-bold ${role === r ? 'text-white' : 'text-slate-300'}`}>{title}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-300 drop-shadow-md">
                {ROLE_OPTIONS.find((o) => o.role === role)?.desc}
              </p>
            </motion.div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-6"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-7">
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
          <p className="mt-4 text-center text-xs text-white/60 drop-shadow-sm">
            Email confirmation is disabled — sign-up grants instant access.
          </p>
        </motion.div>
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
