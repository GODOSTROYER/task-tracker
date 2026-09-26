'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, getToken, removeToken, setToken, SESSION_CHANGED, type User } from '@/lib/api';
import { inspectSession, shouldClearSession } from '@/lib/session';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  sessionError: string;
  isSignedIn: boolean;
  isLoaded: boolean;
  user: User | null;
  signOut: () => void;
  login: (token: string, user: User) => void;
}
const AuthContext = createContext<AuthContextType>({ sessionError: "", isSignedIn: false, isLoaded: false, user: null, signOut: () => {}, login: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionError, setSessionError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let disposed = false;
    let validatedUserId: string | null = null;
    const syncSession = async () => {
      const current = ++generation;
      clearTimeout(timer);
      setSessionError("");
      try {
        const token = getToken();
        if (!token) { validatedUserId = null; setUserData(null); return; }
        const { userId, remaining } = inspectSession(token);
        // Keep active forms mounted when this account receives a refreshed token.
        // An initial login or account switch still waits for server verification.
        if (userId !== validatedUserId) setIsLoaded(false);
        const { user } = await api<{ user: User }>('/api/auth/me', { token });
        if (disposed || current !== generation || getToken() !== token) return;
        validatedUserId = user.id;
        localStorage.setItem('user', JSON.stringify(user));
        setUserData(user);
        timer = setTimeout(syncSession, Math.min(remaining, 2147483647));
      } catch (error) {
        if (disposed || current !== generation) return;
        if (!shouldClearSession(error)) {
          setSessionError('Unable to verify your session. Please retry in a moment.');
          return;
        }
        validatedUserId = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUserData(null);
      } finally { if (!disposed && current === generation) setIsLoaded(true); }
    };
    syncSession();
    window.addEventListener(SESSION_CHANGED, syncSession);
    window.addEventListener('storage', syncSession);
    window.addEventListener('focus', syncSession);
    return () => {
      disposed = true;
      generation++;
      clearTimeout(timer);
      window.removeEventListener(SESSION_CHANGED, syncSession);
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('focus', syncSession);
    };
  }, []);

  const signOut = () => { removeToken(); router.push('/'); };
  const login = (token: string, user: User) => { setToken(token, user); router.push('/workspaces'); };
  return <AuthContext.Provider value={{ sessionError, isSignedIn: !!userData, isLoaded, user: userData, signOut, login }}>{children}</AuthContext.Provider>;
}
export function useUser() { return useContext(AuthContext); }
