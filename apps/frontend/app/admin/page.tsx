'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, UserPlus, UserMinus, Globe, Shield, ShieldOff, Activity, Settings, ShieldAlert } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useAdminPlatform } from './admin-platform-context';

interface ActivityLog {
  id: string;
  action: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  PLATFORM_CREATED: Globe,
  PLATFORM_SETTINGS_CHANGED: Settings,
  INVITE_CREATED: Mail,
  INVITE_REVOKED: Mail,
  USER_JOINED_PLATFORM: UserPlus,
  USER_SELF_REGISTERED: UserPlus,
  USER_ROLE_CHANGED: Shield,
  USER_REMOVED_FROM_PLATFORM: UserMinus,
  SESSION_REVOKED: ShieldOff,
  LOGIN_FAILED: ShieldAlert,
};

function describeActivity(log: ActivityLog): string {
  const actor = log.actorEmail || 'Someone';
  const meta = log.metadata || {};

  switch (log.action) {
    case 'PLATFORM_CREATED':
      return `${actor} created platform "${meta.name ?? ''}"`;
    case 'INVITE_CREATED':
      return `${actor} invited ${meta.email ?? 'a user'} as ${meta.role ?? 'USER'}`;
    case 'INVITE_REVOKED':
      return `${actor} revoked the invitation for ${meta.email ?? 'a user'}`;
    case 'USER_ROLE_CHANGED':
      return `${actor} changed ${meta.email ?? 'a user'} from ${meta.from ?? '?'} to ${meta.to ?? '?'}`;
    case 'USER_REMOVED_FROM_PLATFORM':
      return `${actor} removed ${meta.email ?? 'a user'} from the platform`;
    case 'USER_JOINED_PLATFORM':
      return `${meta.email ?? actor} joined the platform`;
    case 'USER_SELF_REGISTERED':
      return `${meta.email ?? actor} signed up via self-registration`;
    case 'PLATFORM_SETTINGS_CHANGED':
      return `${actor} turned ${meta.setting ?? 'a setting'} ${meta.to ? 'on' : 'off'}`;
    case 'SESSION_REVOKED':
      return `${actor} revoked a session`;
    case 'LOGIN_FAILED':
      return `Failed sign-in attempt for ${meta.email || 'an unknown address'}`;
    default:
      return `${actor} performed ${log.action}`;
  }
}

export default function AdminDashboard() {
  const { platformId } = useAdminPlatform();
  const [stats, setStats] = useState<{totalUsers: number, pendingInvites: number, recentActivity: ActivityLog[]} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!platformId) return;

    const fetchStats = async () => {
      try {
        const res = await apiFetch(`/api/admin/stats?platformId=${platformId}`);

        if (!res.ok) throw new Error('Failed to fetch stats');

        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    fetchStats();
  }, [platformId]);

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

      <Card className="bg-zinc-950/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Activity className="h-4 w-4 text-zinc-500" />
          <CardTitle className="text-sm font-medium text-zinc-400">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/50">
              {stats.recentActivity.map((log) => {
                const Icon = ACTIVITY_ICONS[log.action] || Activity;
                return (
                  <li key={log.id} className="flex items-center gap-3 py-2.5">
                    <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-300 flex-1">{describeActivity(log)}</span>
                    <span className="text-xs text-zinc-500 shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
