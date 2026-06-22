// apps/web/src/contexts/AuthContext.tsx
// Global auth state: access token in memory, user info, auto-refresh on load

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth as authApi, setAccessToken, type User } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to refresh the access token from the httpOnly cookie
  useEffect(() => {
    authApi
      .refresh()
      .then(({ accessToken, user }) => {
        setAccessToken(accessToken);
        setUser(user);
      })
      .catch(() => {
        // No valid session — that's fine
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await authApi.login({ email, password });
    setAccessToken(accessToken);
    setUser(user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { accessToken, user } = await authApi.signup({ name, email, password });
    setAccessToken(accessToken);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
