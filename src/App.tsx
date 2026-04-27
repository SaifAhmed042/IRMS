import { Loader2 } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import StationManager from './components/StationManager';
import LocoPilot from './components/LocoPilot';
import UserReport from './components/UserReport';
import { signOut, useAuth } from './hooks/useAuth';

export default function App() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  if (!session || !profile) return <AuthScreen />;

  const role = profile.role;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header role={role} userName={profile.full_name || session.user.email || ''} onSignOut={signOut} />
      {role === 'manager' && <StationManager />}
      {role === 'locopilot' && <LocoPilot />}
      {role === 'user' && <UserReport />}
    </div>
  );
}
