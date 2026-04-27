import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AppRole = 'manager' | 'locopilot' | 'user';

export interface Profile {
  id: string;
  full_name: string;
  role: AppRole;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, profile: null });

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (session: Session | null) => {
      if (!session) {
        if (mounted) setState({ loading: false, session: null, profile: null });
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (mounted) {
        setState({ loading: false, session, profile: (data as Profile) ?? null });
      }
    };

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        await loadProfile(session);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(params: { email: string; password: string; fullName: string; role: AppRole }) {
  const { error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { full_name: params.fullName, role: params.role },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
