'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSessionProvider } from './admin-session-context';
import { AdminShell } from '@/components/admin/shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) return <div className="min-h-screen bg-background" />;

  return (
    <AdminSessionProvider>
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
