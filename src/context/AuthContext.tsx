import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setUnauthorizedHandler } from '../api/client';

export type User = { id: string; name: string; role: string; photoUrl?: string | null };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Διαχειριστής', MANAGER: 'Υπεύθυνος', WORKER: 'Εργαζόμενος' };
const ROLE_RANK: Record<string, number> = { WORKER: 0, MANAGER: 1, ADMIN: 2 };

// How often a signed-in, foreground app asks the server who it is. The server
// itself checks the real role on every request, so this only decides how fast
// the app's own screens (like the Διαχείριση tab) catch up after a change.
const REFRESH_EVERY_MS = 10000;

function roleChangeMessage(from: string, to: string) {
  const up = (ROLE_RANK[to] ?? 0) > (ROLE_RANK[from] ?? 0);
  let message = `Τώρα είσαι ${ROLE_LABELS[to] || to}. ${up ? 'Απέκτησες νέα δικαιώματα.' : 'Αφαιρέθηκαν ορισμένα δικαιώματα.'}`;
  if (to === 'ADMIN') message += ' Η καρτέλα «Διαχείριση» είναι πλέον διαθέσιμη.';
  else if (from === 'ADMIN') message += ' Η καρτέλα «Διαχείριση» δεν είναι πλέον διαθέσιμη.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Always holds the latest user, so timers and async work never act on a stale copy.
  const userRef = useRef<User | null>(null);
  const refreshing = useRef(false);

  const commitUser = useCallback((next: User | null) => {
    userRef.current = next;
    setUser(next);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((raw) => {
        if (raw) commitUser(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Wire up the API layer's 401 handler to actually clear this context's
    // user state - this is what makes a rejected token redirect to login.
    setUnauthorizedHandler(() => {
      commitUser(null);
    });
  }, [commitUser]);

  const updateUser = useCallback(async (patch: Partial<User>) => {
    const current = userRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    commitUser(next);
    await AsyncStorage.setItem('user', JSON.stringify(next));
  }, [commitUser]);

  // Asks the server for the member's current name and role. If an admin has
  // changed the role, the app switches to it straight away (tabs appear or
  // disappear) and the member is told. A deleted member gets a 401 here, which
  // the API layer already turns into a sign-out.
  const refreshUser = useCallback(async () => {
    if (refreshing.current || !userRef.current) return;
    refreshing.current = true;
    try {
      const fresh = await api.getMe();
      const current = userRef.current;
      if (!current || !fresh || fresh.id !== current.id) return;
      if (fresh.role === current.role && fresh.name === current.name) return;

      const roleChanged = fresh.role !== current.role;
      await updateUser({ role: fresh.role, name: fresh.name });
      if (roleChanged) Alert.alert('Ο ρόλος σου άλλαξε', roleChangeMessage(current.role, fresh.role));
    } catch {
      // Offline or the server is unreachable: keep what we have and try again later.
    } finally {
      refreshing.current = false;
    }
  }, [updateUser]);

  // Check right after signing in / opening the app, whenever the app comes
  // back to the foreground, and every few seconds while it stays open.
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(refreshUser, REFRESH_EVERY_MS); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    // Only an explicit "background" pauses the checks: right at launch some
    // devices report "unknown" for a moment, and that must not skip them.
    if (AppState.currentState !== 'background') { refreshUser(); start(); }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') stop();
      else if (state === 'active') { refreshUser(); start(); }
    });
    return () => { stop(); sub.remove(); };
  }, [user?.id, refreshUser]);

  async function login(phone: string, password: string) {
    const data = await api.login(phone, password);
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    commitUser(data.user);
  }

  async function logout() {
    try {
      await AsyncStorage.multiRemove(['token', 'user']);
    } finally {
      commitUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
