"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api, SESSION_INVALID_EVENT } from "./api";

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
    // Force a full hard navigation, not a client-side router.push. This is
    // deliberate: a soft SPA navigation leaves every other already-mounted
    // component's local state (e.g. an admin page that fetched data into
    // its own useState before logout) sitting in memory untouched — only a
    // real page load guarantees nothing already-rendered can keep showing
    // stale, no-longer-authorized data. See docs/roles-permissions/ for the
    // bug this closes (logging out didn't clear a currently-open admin page).
    window.location.href = "/";
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

  // Any authenticated request anywhere in the app that comes back 401 means
  // our session is no longer valid (logged out in another tab, expired, or
  // revoked/banned/suspended/restricted mid-session — see
  // docs/roles-permissions/ROLES_PERMISSIONS.md §1/§4). Force the same
  // hard, full-page logout as clicking "Log out" — this is what actually
  // makes force-logout/ban/suspend real-time from the user's point of view,
  // instead of only affecting the *next* page load.
  useEffect(() => {
    const handleSessionInvalid = () => logout();
    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, loading, setAuth, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
