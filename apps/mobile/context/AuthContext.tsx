import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { User } from '@the-caddy/shared';

// On web, SecureStore is not available — fall back to localStorage
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await storage.getItem('auth_token');
        const storedUser = await storage.getItem('auth_user');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (newToken: string, newUser: User) => {
    await storage.setItem('auth_token', newToken);
    await storage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user || !token) return;
    const updated = { ...user, ...updates };
    await storage.setItem('auth_user', JSON.stringify(updated));
    setUser(updated);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const { API_BASE } = await import('../constants/api');
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      const freshUser: User = json.data ?? json;
      await storage.setItem('auth_user', JSON.stringify(freshUser));
      setUser(freshUser);
    } catch {
      // ignore — keep existing user
    }
  };

  const signOut = async () => {
    await storage.deleteItem('auth_token');
    await storage.deleteItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, updateUser, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
