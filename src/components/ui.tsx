import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const hasBg = className.includes('bg-');
  return (
    <div
      className={`${hasBg ? '' : 'bg-white'} rounded-xl shadow-soft border border-slate-200/70 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <h3 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{children}</h3>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Pill({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'blue';
  children: ReactNode;
}) {
  const map: Record<string, string> = {
    slate:   'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    amber:   'bg-amber-100 text-amber-700 ring-amber-200',
    rose:    'bg-rose-100 text-rose-700 ring-rose-200',
    blue:    'bg-rail-50 text-rail-600 ring-rail-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'slate',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'blue';
}) {
  const accent: Record<string, string> = {
    slate:   'text-slate-900',
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
    rose:    'text-rose-600',
    blue:    'text-rail-500',
  };
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-rail-500 text-white hover:bg-rail-600 active:bg-rail-700 shadow-soft',
    ghost:   'text-slate-600 hover:bg-slate-100',
    danger:  'bg-rose-500 text-white hover:bg-rose-600 shadow-soft',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
