import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, type Business, type User } from '@/lib/api';

export type Session = { user: User; business: Business };
type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider tidak ditemukan');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try { setSession(await api<Session>('/auth/me')); }
    catch { setSession(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const logout = async () => {
    try { await post('/auth/logout', {}); } finally { setSession(null); }
  };
  return <AuthContext.Provider value={{ session, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}
