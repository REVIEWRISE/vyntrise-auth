'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail } from 'lucide-react';

import { apiFetch } from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState<{totalUsers: number, pendingInvites: number} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiFetch('/api/admin/stats');
        
        if (!res.ok) throw new Error('Failed to fetch stats');
        
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    fetchStats();
  }, []);

  if (error) return (
    <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
      {error}
    </div>
  );

  if (!stats) return <div className="text-zinc-400">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Overview of your platform activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-950/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Pending Invites
            </CardTitle>
            <Mail className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-50">{stats.pendingInvites}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
