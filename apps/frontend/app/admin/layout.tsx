'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, Mail, LogOut, Globe } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex flex-col p-4 shrink-0">
        <div className="mb-8 px-4 py-2">
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">Vyntrise</h2>
          <p className="text-xs text-zinc-400 font-medium tracking-wider uppercase mt-1">Admin Portal</p>
        </div>

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
              variant={pathname === '/admin/platforms' ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-3 font-medium"
            >
              <Globe className="h-4 w-4" />
              Platforms
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
