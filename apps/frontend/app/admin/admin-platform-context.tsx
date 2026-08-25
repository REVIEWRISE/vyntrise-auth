'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface AdminPlatform {
  id: string;
  name: string;
}

interface AdminPlatformContextValue {
  platforms: AdminPlatform[];
  platformId: string;
  setPlatformId: (id: string) => void;
}

const AdminPlatformContext = createContext<AdminPlatformContextValue | null>(null);

const STORAGE_KEY = 'adminSelectedPlatformId';

// Admin data requests must be scoped to one platform explicitly — without a platformId,
// requireAdmin falls back to an arbitrary platform the caller administers, which silently
// mixes data across platforms for anyone who administers more than one. This provider is the
// single source of truth for "which platform is the admin currently looking at," and doubles
// as the /admin section's access gate: it redirects away anyone who isn't an admin of at
// least one platform, since the sidebar previously only checked "is logged in".
export function AdminPlatformProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<AdminPlatform[]>([]);
  const [platformId, setPlatformIdState] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied'>('loading');

  useEffect(() => {
    apiFetch('/api/admin/platforms')
      .then(async (res) => {
        if (!res.ok) throw new Error('Not an admin of any platform');
        return res.json() as Promise<AdminPlatform[]>;
      })
      .then((data) => {
        if (data.length === 0) throw new Error('Not an admin of any platform');
        setPlatforms(data);
        const stored = localStorage.getItem(STORAGE_KEY);
        const initial = stored && data.some((p) => p.id === stored) ? stored : data[0].id;
        setPlatformIdState(initial);
        localStorage.setItem(STORAGE_KEY, initial);
        setStatus('ready');
      })
      .catch(() => setStatus('denied'));
  }, []);

  useEffect(() => {
    if (status === 'denied') router.push('/account');
  }, [status, router]);

  const setPlatformId = (id: string) => {
    setPlatformIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  if (status !== 'ready') {
    return <div className="p-8 text-zinc-400">{status === 'loading' ? 'Loading...' : 'Redirecting...'}</div>;
  }

  return (
    <AdminPlatformContext.Provider value={{ platforms, platformId, setPlatformId }}>
      {children}
    </AdminPlatformContext.Provider>
  );
}

export function useAdminPlatform() {
  const ctx = useContext(AdminPlatformContext);
  if (!ctx) throw new Error('useAdminPlatform must be used within AdminPlatformProvider');
  return ctx;
}
