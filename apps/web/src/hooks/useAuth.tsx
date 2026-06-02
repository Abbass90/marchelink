import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  authLogin,
  authLogout,
  authMe,
  authRefresh,
  authRegister,
  authRegisterWholesaler,
  ApiError,
} from '../api/client.js';
import type { LoginPayload, RegisterPayload, RegisterWholesalerPayload, UserProfile } from '../api/client.js';

/* ── Types ───────────────────────────────────────────── */

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  registerWholesaler: (payload: RegisterWholesalerPayload) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions & { isAuthenticated: boolean };

/* ── Context ─────────────────────────────────────────── */

/**
 * Exporté pour permettre une lecture *optionnelle* de l'auth ailleurs
 * (ex. CartContext via useContext(AuthContext) qui tolère `null` hors provider).
 * Utiliser le hook `useAuth()` pour une consommation normale (qui throw si absent).
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

/* ── Auto-Refresh Interval (12 min — before the 15 min access TTL) ── */

const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

/* ── Provider ────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Silent refresh helper ─────────────────────────── */

  const silentRefresh = useCallback(async (): Promise<boolean> => {
    try {
      await authRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  /* ── Start / stop the auto-refresh loop ────────────── */

  const startRefreshLoop = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setInterval(() => {
      void silentRefresh();
    }, REFRESH_INTERVAL_MS);
  }, [silentRefresh]);

  const stopRefreshLoop = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  /* ── Boot: restore session from httpOnly cookie ───── */

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const user = await authMe();
        if (!cancelled) {
          setState({ user, loading: false, error: null });
          startRefreshLoop();
        }
      } catch (err) {
        // 401 → not logged in (normal), any other error → try refresh once
        if (err instanceof ApiError && err.status === 401) {
          const refreshed = await silentRefresh();
          if (refreshed && !cancelled) {
            try {
              const user = await authMe();
              if (!cancelled) {
                setState({ user, loading: false, error: null });
                startRefreshLoop();
                return;
              }
            } catch {
              /* fall through to unauthenticated */
            }
          }
        }
        if (!cancelled) {
          setState({ user: null, loading: false, error: null });
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      stopRefreshLoop();
    };
  }, [silentRefresh, startRefreshLoop, stopRefreshLoop]);

  /* ── Actions ───────────────────────────────────────── */

  const login = useCallback(
    async (payload: LoginPayload) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        await authLogin(payload);
        const user = await authMe();
        setState({ user, loading: false, error: null });
        startRefreshLoop();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Erreur de connexion';
        setState((s) => ({ ...s, loading: false, error: message }));
        throw err;
      }
    },
    [startRefreshLoop],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        await authRegister(payload);
        // Email verification required — cannot auto-login.
        // The caller (Register.tsx) shows a "check your email" success state.
        setState((s) => ({ ...s, loading: false }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Erreur lors de l'inscription";
        setState((s) => ({ ...s, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  const registerWholesaler = useCallback(
    async (payload: RegisterWholesalerPayload) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        await authRegisterWholesaler(payload);
        // Email verification required — cannot auto-login.
        setState((s) => ({ ...s, loading: false }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Erreur lors de l'inscription";
        setState((s) => ({ ...s, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch {
      /* Best-effort: clear local state even if server fails */
    }
    stopRefreshLoop();
    setState({ user: null, loading: false, error: null });
  }, [stopRefreshLoop]);

  const reloadUser = useCallback(async () => {
    try {
      const user = await authMe();
      setState((s) => ({ ...s, user }));
    } catch {
      /* Silent — caller handles error display */
    }
  }, []);

  /* ── Memoized value ────────────────────────────────── */

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.user !== null,
      login,
      register,
      registerWholesaler,
      logout,
      reloadUser,
    }),
    [state, login, register, registerWholesaler, logout, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Hook ────────────────────────────────────────────── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
