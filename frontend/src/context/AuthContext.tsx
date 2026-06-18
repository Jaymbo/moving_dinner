import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, groups, setToken, getToken } from '../api/client';

interface User {
  id: number;
  name: string;
  email: string;
  isGuest: boolean;
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdminAnywhere: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, address?: string, maxGuests?: number) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminAnywhere, setIsAdminAnywhere] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsAdminAnywhere(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    try {
      const u = await auth.me();
      setUser(u as User);
      setIsSuperAdmin(!!(u as any).isSuperAdmin);
      // Check if user is admin in any group
      try {
        const myGroups = await groups.list();
        const admin = myGroups.some((g: any) => g.role === 'admin');
        setIsAdminAnywhere(admin);
      } catch {
        setIsAdminAnywhere(false);
      }
    } catch {
      setToken(null);
      setUser(null);
      setIsAdminAnywhere(false);
      setIsSuperAdmin(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await auth.login(email, password);
    setToken(res.token);
    // Use isSuperAdmin from login response, then refresh full user data
    const initialSuperAdmin = !!(res as any).isSuperAdmin;
    setUser({ id: res.id, name: res.name, email: res.email, isGuest: false, isSuperAdmin: initialSuperAdmin });
    setIsSuperAdmin(initialSuperAdmin);
    // Fetch full admin status after login
    try {
      const u = await auth.me();
      setUser(u as User);
      setIsSuperAdmin(!!(u as any).isSuperAdmin);
      const myGroups = await groups.list();
      const admin = myGroups.some((g: any) => g.role === 'admin');
      setIsAdminAnywhere(admin);
    } catch {
      setIsAdminAnywhere(false);
      setIsSuperAdmin(false);
    }
  };

  const register = async (name: string, email: string, password: string, address?: string, maxGuests?: number) => {
    const res = await auth.register(name, email, password, address, maxGuests);
    setToken(res.token);
    // Use isSuperAdmin from register response (first user gets super-admin)
    const initialSuperAdmin = !!(res as any).isSuperAdmin;
    setUser({ id: res.id, name: res.name, email: res.email, isGuest: false, isSuperAdmin: initialSuperAdmin });
    setIsSuperAdmin(initialSuperAdmin);
    // New users (except first) are not admin anywhere
    if (!initialSuperAdmin) {
      setIsAdminAnywhere(false);
    } else {
      // First user is super-admin, refresh full status
      try {
        const u = await auth.me();
        setUser(u as User);
        setIsSuperAdmin(!!(u as any).isSuperAdmin);
        const myGroups = await groups.list();
        const admin = myGroups.some((g: any) => g.role === 'admin');
        setIsAdminAnywhere(admin);
      } catch {
        // ignore
      }
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAdminAnywhere(false);
    setIsSuperAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdminAnywhere, isSuperAdmin, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
