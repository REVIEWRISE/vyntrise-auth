'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Globe,
  LogIn,
  LogOut,
  MailCheck,
  MonitorSmartphone,
  MoreHorizontal,
  ScrollText,
  Shield,
  ShieldAlert,
  UserCheck,
  UserMinus,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_PLATFORMS, useAdminSession } from '../../admin-session-context';
import { useUserDetail, useUserSessions, type Role, type UserDetail } from '@/lib/admin-api';
import { ConfirmDialog, EmptyState, ErrorState, Panel, PanelHeader, StatusPill } from '@/components/admin/primitives';
import { Avatar, RelativeTime, UserAgentLabel, formatDate, formatDateTime } from '@/components/admin/format';
import { DisableUserDialog, UserStatus, useUserMutations } from '@/components/admin/user-actions';
import { AuditTable } from '@/components/admin/audit-table';

function Fact({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-muted/40">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { isSuperAdmin, me, scope } = useAdminSession();
  const { data: user, isLoading, isError, error, refetch } = useUserDetail(userId);
  const m = useUserMutations();
  const [dialog, setDialog] = useState<null | 'disable' | 'signout' | { remove: UserDetail['memberships'][number] }>(null);

  if (isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const isSelf = user.id === me.id;

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Profile header */}
      <Panel className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar email={user.email} className="h-16 w-16 text-lg ring-4 ring-background" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{user.email}</h1>
                {isSelf && <StatusPill tone="neutral">You</StatusPill>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <UserStatus user={user} />
                {user.emailVerified && <StatusPill tone="good"><CheckCircle2 className="-ml-0.5 h-3 w-3" />Email verified</StatusPill>}
                {user.isSuperAdmin && <StatusPill tone="warn"><Crown className="-ml-0.5 h-3 w-3" />Super-admin</StatusPill>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!user.emailVerified && (
              <Button variant="outline" onClick={() => m.resendVerification.mutate(user.id)} disabled={m.resendVerification.isPending}>
                <MailCheck /> Resend verification
              </Button>
            )}
            {isSuperAdmin && !isSelf && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setDialog('signout')} disabled={user.sessionCount === 0}>
                    <LogOut /> Sign out everywhere
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user.disabledAt ? (
                    <DropdownMenuItem onSelect={() => m.enable.mutate(user.id)}>
                      <UserCheck /> Re-enable account
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem destructive onSelect={() => setDialog('disable')}>
                      <UserX /> Disable account
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {user.disabledAt && (
          <div className="relative mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Disabled {formatDateTime(user.disabledAt)}{user.disabledByEmail && ` by ${user.disabledByEmail}`}</p>
              {user.disabledReason && <p className="mt-0.5 text-muted-foreground">“{user.disabledReason}”</p>}
            </div>
          </div>
        )}

        <div className="relative mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={LogIn} label="Last sign-in">
            <RelativeTime value={user.lastLoginAt} />
          </Fact>
          <Fact icon={CalendarDays} label="Account created">{formatDate(user.createdAt)}</Fact>
          <Fact icon={Globe} label="Platforms">{user.memberships.length}</Fact>
          <Fact icon={MonitorSmartphone} label="Active sessions">{user.sessionCount}</Fact>
        </div>
      </Panel>

      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="access"><Shield /> Access</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="sessions"><MonitorSmartphone /> Sessions <span className="rounded bg-muted px-1.5 text-xs tabular">{user.sessionCount}</span></TabsTrigger>}
          <TabsTrigger value="activity"><ScrollText /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="access">
          <Panel>
            <PanelHeader title="Platform access" description={isSuperAdmin ? 'Every platform this account belongs to.' : 'Platforms you administer that this account belongs to.'} />
            {user.memberships.length === 0 ? (
              <EmptyState icon={Globe} title="No platform access" description="This account is not a member of any platform." />
            ) : (
              <ul className="divide-y border-t">
                {user.memberships.map((ms) => (
                  <li key={ms.platformId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border bg-muted text-xs font-semibold uppercase">{ms.platformName[0]}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/platforms/${ms.platformId}`} className="font-medium hover:text-primary">{ms.platformName}</Link>
                      <div className="text-xs text-muted-foreground">Member since {formatDate(ms.joinedAt)}</div>
                    </div>
                    {ms.canManage ? (
                      <>
                        <Select
                          value={ms.role}
                          onValueChange={(role) =>
                            m.changeRole.mutate({ userId: user.id, platformId: ms.platformId, role: role as Role, email: user.email })
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">Member</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDialog({ remove: ms })} aria-label={`Remove from ${ms.platformName}`}>
                          <UserMinus />
                        </Button>
                      </>
                    ) : (
                      <StatusPill tone={ms.role === 'ADMIN' ? 'brand' : 'neutral'}>{ms.role === 'ADMIN' ? 'Admin' : 'Member'}</StatusPill>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="sessions">
            <SessionsPanel userId={user.id} onSignOutAll={() => setDialog('signout')} />
          </TabsContent>
        )}

        <TabsContent value="activity">
          {/* A platform admin sees this user's events on the platform they are looking at. */}
          <AuditTable scope={isSuperAdmin ? ALL_PLATFORMS : scope} filters={{ userId: user.id }} showPlatform compact />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={dialog === 'signout'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Sign out of every device?"
        description={`All ${user.sessionCount} sessions for ${user.email} end immediately. They can sign in again unless the account is disabled.`}
        confirmLabel="Sign out everywhere"
        onConfirm={() => m.revokeSessions.mutateAsync({ userId: user.id })}
      />
      {dialog && typeof dialog === 'object' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Remove from ${dialog.remove.platformName}?`}
          description={`${user.email} will lose access to ${dialog.remove.platformName}. Their account and other memberships are unaffected.`}
          confirmLabel="Remove"
          onConfirm={async () => {
            await m.remove.mutateAsync({ userId: user.id, platformId: dialog.remove.platformId, email: user.email });
            // A platform admin may no longer be allowed to see this user at all.
            if (!isSuperAdmin && user.memberships.length === 1) router.push('/admin/users');
          }}
        />
      )}
      <DisableUserDialog
        open={dialog === 'disable'}
        onOpenChange={(o) => !o && setDialog(null)}
        email={user.email}
        onConfirm={(reason) => m.disable.mutateAsync({ userId: user.id, reason })}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> All users
    </Link>
  );
}

function SessionsPanel({ userId, onSignOutAll }: { userId: string; onSignOutAll: () => void }) {
  const { data, isLoading } = useUserSessions(userId, true);
  const m = useUserMutations();

  return (
    <Panel>
      <PanelHeader
        title="Active sessions"
        description="Each row is a signed-in device. Revoking one signs that device out on its next request."
        actions={
          data && data.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onSignOutAll}>
              <LogOut /> Revoke all
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <div className="space-y-2 px-5 pb-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={MonitorSmartphone} title="No active sessions" description="This user is signed out everywhere." />
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">IP address</th>
                <th className="px-3 py-2 font-medium">Signed in</th>
                <th className="px-3 py-2 font-medium">Last active</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <UserAgentLabel ua={s.userAgent} />
                      {s.isCurrent && <StatusPill tone="brand">This device</StatusPill>}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{s.ipAddress ?? '—'}</td>
                  <td className="px-3 py-3 text-muted-foreground"><RelativeTime value={s.createdAt} /></td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <RelativeTime value={s.lastUsedAt} />
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={m.revokeSessions.isPending}
                      onClick={() => m.revokeSessions.mutate({ userId, sessionId: s.id })}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
