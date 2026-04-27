import { TrainFront, Activity, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  role: 'manager' | 'locopilot' | 'user';
  userName: string;
  onSignOut: () => void;
  children?: ReactNode;
}

const ROLE_LABEL: Record<Props['role'], string> = {
  manager: 'Station Manager',
  locopilot: 'Loco Pilot',
  user: 'Public Reporter',
};

export default function Header({ role, userName, onSignOut, children }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 shadow-soft">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rail-500 flex items-center justify-center text-white">
            <TrainFront size={20} />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-none text-rail-700">IRMS</div>
            <div className="text-[11px] text-slate-500 leading-none mt-1">Intelligent Rail Management</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <Activity size={14} className="text-emerald-500" />
          <span>Realtime</span>
        </div>
        <div className="flex-1" />
        {children}
        <div className="flex items-center gap-3">
          <div className="text-right max-w-[200px] truncate">
            <div className="text-[11px] text-slate-500 truncate">{ROLE_LABEL[role]}</div>
            <div className="text-sm font-semibold text-rail-700 truncate">{userName}</div>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
