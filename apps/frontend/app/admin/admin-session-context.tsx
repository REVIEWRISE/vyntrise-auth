'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminMe, type AdminMe } from '@/lib/admin-api';
import { BrandMark } from '@/components/admin/brand';

export const ALL_PLATFORMS = 'all';

interface AdminSessionValue {
  me: AdminMe;
  isSuperAdmin: boolean;
  platforms: AdminMe['platforms'];
  // A platform id, or ALL_PLATFORMS for a super-admin looking across every platform.
  scope: string;
  setScope: (scope: string) => void;
  // The selected platform when one is selected; null in the all-platforms view.
  platform: AdminMe['platforms'][number] | null;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

const STORAGE_KEY = 'adminSelectedPlatformId';

function readStoredScope(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// The single source of truth for who is using the console and which platform they are looking
// at. It also gates /admin: GET /api/admin/me answers 403 for anyone who administers nothing,
// and they are sent to their account page. The backend enforces every permission regardless;
// this only decides what to render.
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: me, isError } = useAdminMe();
  const [chosen, setChosen] = useState<string | null>(() => readStoredScope());

  useEffect(() => {
    if (isError) router.replace('/account');
  }, [isError, router]);

  // Resolve the stored choice against what this user may actually see: a stale id, or "all"
  // for someone who is not a super-admin, falls back to their first platform.
  const scope = useMemo(() => {
    if (!me) return '';
    if (chosen === ALL_PLATFORMS && me.isSuperAdmin) return ALL_PLATFORMS;
    if (chosen && me.platforms.some((p) => p.id === chosen)) return chosen;
    return me.platforms[0]?.id ?? (me.isSuperAdmin ? ALL_PLATFORMS : '');
  }, [me, chosen]);

  const setScope = useCallback((next: string) => {
    setChosen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice simply won't survive a reload.
    }
  }, []);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-in fade-in-0 duration-500">
          <BrandMark className="h-10 w-10 animate-pulse" />
          <p className="text-sm">{isError ? 'Redirecting…' : 'Loading console…'}</p>
        </div>
      </div>
    );
  }

  const value: AdminSessionValue = {
    me,
    isSuperAdmin: me.isSuperAdmin,
    platforms: me.platforms,
    scope,
    setScope,
    platform: me.platforms.find((p) => p.id === scope) ?? null,
  };

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used within AdminSessionProvider');
  return ctx;
}
