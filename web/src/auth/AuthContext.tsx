import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, setToken, clearToken, getCurrentUser } from '@/api/client';
import type { Role, User } from '@/lib/types';

interface AuthState {
  user: User | null;
  role: Role | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getCurrentUser()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ data: User }>('/auth/me');
      setUser(res.data);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ data: { accessToken: string; user: User } }>('/auth/login', { email, password });
      setToken(res.data.accessToken);
      setUser(res.data.user);
    },
    [],
  );

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.post<{ data: User }>('/auth/signup', { email, password, name });
    return res.data;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
