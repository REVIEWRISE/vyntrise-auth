'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, Mail, LogOut, Globe, User, BookOpen } from 'lucide-react';
import { AdminPlatformProvider, useAdminPlatform } from './admin-platform-context';

function PlatformSwitcher() {
  const { platforms, platformId, setPlatformId } = useAdminPlatform();

  if (platforms.length <= 1) {
    return (
      <div className="px-4 py-2 mb-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Platform</p>
        <p className="text-sm text-zinc-200 font-medium truncate">{platforms[0]?.name ?? '—'}</p>
      </div>
    );
  }

  return (
    <div className="px-4 mb-2">
      <label htmlFor="platform-switcher" className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">
        Platform
      </label>
      <select
        id="platform-switcher"
        value={platformId}
        onChange={(e) => setPlatformId(e.target.value)}
        className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex flex-col p-4 shrink-0">
        <div className="mb-8 px-4 py-2">
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">Vyntrise</h2>
          <p className="text-xs text-zinc-400 font-medium tracking-wider uppercase mt-1">Admin Portal</p>
        </div>

        <PlatformSwitcher />

        <nav className="flex flex-col gap-2 flex-1">
          <Link href="/admin">
            <Button 
              variant={pathname === '/admin' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3 font-medium"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button 
              variant={pathname === '/admin/users' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3 font-medium"
            >
              <Users className="h-4 w-4" />
              Users
            </Button>
          </Link>
          <Link href="/admin/invites">
            <Button
              variant={pathname === '/admin/invites' ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-3 font-medium"
            >
              <Mail className="h-4 w-4" />
              Invitations
            </Button>
          </Link>
          <Link href="/admin/platforms">
            <Button
              variant={pathname === '/admin/platforms' || pathname.startsWith('/admin/platforms/') ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-3 font-medium"
            >
              <Globe className="h-4 w-4" />
              Platforms
            </Button>
          </Link>
          <Link href="/admin/docs">
            <Button
              variant={pathname === '/admin/docs' ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-3 font-medium"
            >
              <BookOpen className="h-4 w-4" />
              Docs
            </Button>
          </Link>
          
          <div className="border-t border-zinc-800/50 my-2" />
          
          <Link href="/account">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 font-medium text-zinc-400 hover:text-zinc-50"
            >
              <User className="h-4 w-4" />
              My Account
            </Button>
          </Link>

          <div className="mt-auto pt-4 border-t border-zinc-800/50">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
              onClick={() => {
                localStorage.removeItem('accessToken');
                router.push('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) return <div className="p-8 text-zinc-400">Loading...</div>;

  return (
    <AdminPlatformProvider>
      <AdminShell>{children}</AdminShell>
    </AdminPlatformProvider>
  );
}
