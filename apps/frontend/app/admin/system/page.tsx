'use client';

import { Crown, KeyRound, ServerCog, ShieldCheck, Terminal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminSession } from '../admin-session-context';
import { useSigningKeys, useSuperAdmins } from '@/lib/admin-api';
import { EmptyState, PageHeader, Panel, PanelHeader, StatusPill } from '@/components/admin/primitives';
import { CodeBlock } from '@/components/admin/code-block';
import { Avatar, RelativeTime, formatDate } from '@/components/admin/format';
import Link from 'next/link';

export default function SystemPage() {
  const { isSuperAdmin } = useAdminSession();
  const keys = useSigningKeys(isSuperAdmin);
  const admins = useSuperAdmins(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <Panel>
        <EmptyState icon={ServerCog} title="Super-admins only" description="System settings span every platform, so only super-admins can see them." />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System" description="Server-wide security configuration. Read-only here; changes are made from the server." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader icon={KeyRound} title="Token signing keys" description="RS256 key pairs. The active key signs new tokens; retired keys stay published until tokens signed with them expire." />
          {keys.isLoading ? (
            <div className="space-y-2 px-5 pb-5">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <ul className="divide-y border-t">
              {(keys.data ?? []).map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                  <ShieldCheck className={`h-4 w-4 shrink-0 ${k.isActive ? 'text-success' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <code className="block truncate font-mono text-xs">{k.kid}</code>
                    <span className="text-xs text-muted-foreground">
                      {k.algorithm} · created {formatDate(k.createdAt)}
                      {k.retiredAt && ` · retired ${formatDate(k.retiredAt)}`}
                    </span>
                  </div>
                  {k.isActive ? <StatusPill tone="good">Active</StatusPill> : <StatusPill tone="neutral">{k.retiredAt ? 'Retired' : 'Inactive'}</StatusPill>}
                </li>
              ))}
            </ul>
          )}
          <p className="px-5 py-3 text-xs text-muted-foreground">
            Published at <Link href="/.well-known/jwks.json" className="font-mono text-primary hover:underline">/.well-known/jwks.json</Link>
          </p>
        </Panel>

        <Panel>
          <PanelHeader icon={Crown} title="Super-admins" description="Accounts with control over every platform." />
          {admins.isLoading ? (
            <div className="space-y-2 px-5 pb-5">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <ul className="divide-y border-t">
              {(admins.data ?? []).map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/users/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40">
                    <Avatar email={a.email} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.email}</div>
                      <div className="text-xs text-muted-foreground">Last sign-in <RelativeTime value={a.lastLoginAt} /></div>
                    </div>
                    {a.disabledAt && <StatusPill tone="bad">Disabled</StatusPill>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-medium"><Terminal className="h-4 w-4 text-muted-foreground" /> Granting and revoking</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deliberately not possible from the console, so a stolen admin session can never escalate itself. Run on the server:
            </p>
            <CodeBlock lang="bash" code={`docker compose exec backend node dist/scripts/super-admin.js grant someone@example.com
docker compose exec backend node dist/scripts/super-admin.js revoke someone@example.com
docker compose exec backend node dist/scripts/super-admin.js list`} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
