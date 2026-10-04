import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setUnauthorizedHandler } from '../api/client';

type User = { id: string; name: string; role: string; photoUrl?: string | null };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((raw) => { if (raw) setUser(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setLoading(false));
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  async function login(phone: string, password: string) {
    const data = await api.login(phone, password);
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  }

  async function logout() {
    try {
      await AsyncStorage.multiRemove(['token', 'user']);
    } finally {
      setUser(null);
    }
  }

  async function updateUser(partial: Partial<User>) {
    setUser((prev) => {
      const next = prev ? { ...prev, ...partial } : prev;
      if (next) AsyncStorage.setItem('user', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
