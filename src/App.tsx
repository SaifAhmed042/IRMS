import { useState } from 'react';
import RoleSelect from './components/RoleSelect';
import Header from './components/Header';
import StationManager from './components/StationManager';
import LocoPilot from './components/LocoPilot';
import UserReport from './components/UserReport';

type Role = 'manager' | 'locopilot' | 'user';

export default function App() {
  const [role, setRole] = useState<Role | null>(null);

  if (!role) return <RoleSelect onPick={setRole} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header role={role} onChangeRole={() => setRole(null)} />
      {role === 'manager' && <StationManager />}
      {role === 'locopilot' && <LocoPilot />}
      {role === 'user' && <UserReport />}
    </div>
  );
}
