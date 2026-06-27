"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "./api";

interface AuthContextType {
  user: any | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string | null) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  setAuth: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (t: string) => {
    try {
      const u = await api.auth.me();
      setUser(u);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  }, []);

  const setAuth = useCallback(async (t: string | null) => {
    if (t) {
      localStorage.setItem("token", t);
      setToken(t);
      await fetchUser(t);
    } else {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  }, [fetchUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (t && !user) {
      setToken(t);
      await fetchUser(t);
    }
  }, [user, fetchUser]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      fetchUser(t).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, token, loading, setAuth, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
