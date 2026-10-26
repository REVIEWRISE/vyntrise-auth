'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Eye,
  Layers,
  MailCheck,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ALL_PLATFORMS, useAdminSession } from '../admin-session-context';
import { useUsers, type UserRow } from '@/lib/admin-api';
import { useDebounced } from '@/lib/use-debounced';
import { DataTable, ToolbarSearch, type ColumnDef } from '@/components/admin/data-table';
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, StatusPill } from '@/components/admin/primitives';
import { Avatar, RelativeTime, formatDate } from '@/components/admin/format';
import { DisableUserDialog, UserStatus, useUserMutations } from '@/components/admin/user-actions';
import { RangeTabs } from '@/components/admin/charts';

const PAGE_SIZE = 25;

type Pending =
  | { kind: 'remove'; users: UserRow[] }
  | { kind: 'role'; users: UserRow[]; role: 'ADMIN' | 'USER' }
  | { kind: 'disable'; user: UserRow }
  | null;

export default function UsersPage() {
  const router = useRouter();
  const { scope, isSuperAdmin, platform } = useAdminSession();
  // A super-admin looking at one platform can widen the list to every account.
  const [widen, setWiden] = useState(false);
  const listScope = scope === ALL_PLATFORMS || widen ? ALL_PLATFORMS : scope;
  const platformScoped = listScope !== ALL_PLATFORMS;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('any');
  const [role, setRole] = useState('any');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim(), 250);

  const params = {
    q: q || undefined,
    status: status === 'any' ? undefined : status,
    role: platformScoped && role !== 'any' ? role : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, isError, error, refetch } = useUsers(listScope, params);
  const m = useUserMutations();
  const [pending, setPending] = useState<Pending>(null);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const columns = useMemo<ColumnDef<UserRow, unknown>[]>(() => {
    const cols: ColumnDef<UserRow, unknown>[] = [
      {
        accessorKey: 'email',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex min-w-[220px] items-center gap-3">
            <Avatar email={row.original.email} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{row.original.email}</span>
                {row.original.isSuperAdmin && <Crown className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Super-admin" />}
              </div>
              <div className="text-xs text-muted-foreground">Joined {formatDate(row.original.accessCreatedAt ?? row.original.createdAt)}</div>
            </div>
          </div>
        ),
      },
    ];
    if (platformScoped) {
      cols.push({
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) =>
          row.original.role === 'ADMIN' ? (
            <StatusPill tone="brand"><Shield className="-ml-0.5 h-3 w-3" />Admin</StatusPill>
          ) : (
            <span className="text-muted-foreground">Member</span>
          ),
      });
    } else {
      cols.push({
        id: 'platforms',
        header: 'Platforms',
        enableSorting: false,
        cell: ({ row }) => {
          const ps = row.original.platforms ?? [];
          if (ps.length === 0) return <span className="text-muted-foreground">None</span>;
          return (
            <div className="flex max-w-[260px] flex-wrap gap-1">
              {ps.slice(0, 3).map((p) => (
                <span key={p.id} className="rounded-md border bg-muted/50 px-1.5 py-0.5 text-xs">
                  {p.name}
                  {p.role === 'ADMIN' && <span className="ml-1 text-primary">·admin</span>}
                </span>
              ))}
              {ps.length > 3 && <span className="text-xs text-muted-foreground">+{ps.length - 3}</span>}
            </div>
          );
        },
      });
    }
    cols.push(
      {
        id: 'status',
        header: 'Status',
        accessorFn: (u) => (u.disabledAt ? 2 : u.emailVerified ? 0 : 1),
        cell: ({ row }) => <UserStatus user={row.original} />,
      },
      {
        accessorKey: 'lastLoginAt',
        header: 'Last sign-in',
        sortUndefined: 'last',
        cell: ({ row }) => <RelativeTime value={row.original.lastLoginAt} className="text-muted-foreground" />,
      },
      {
        id: 'actions',
        header: '',
        size: 48,
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${u.email}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/users/${u.id}`}><Eye /> View profile</Link>
                  </DropdownMenuItem>
                  {platformScoped && (
                    <DropdownMenuItem onSelect={() => setPending({ kind: 'role', users: [u], role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })}>
                      <Shield /> {u.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                    </DropdownMenuItem>
                  )}
                  {!u.emailVerified && (
                    <DropdownMenuItem onSelect={() => m.resendVerification.mutate(u.id)}>
                      <MailCheck /> Resend verification
                    </DropdownMenuItem>
                  )}
                  {(platformScoped || isSuperAdmin) && <DropdownMenuSeparator />}
                  {platformScoped && (
                    <DropdownMenuItem destructive onSelect={() => setPending({ kind: 'remove', users: [u] })}>
                      <UserMinus /> Remove from platform
                    </DropdownMenuItem>
                  )}
                  {isSuperAdmin &&
                    (u.disabledAt ? (
                      <DropdownMenuItem onSelect={() => m.enable.mutate(u.id)}>
                        <UserCheck /> Re-enable account
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem destructive onSelect={() => setPending({ kind: 'disable', user: u })}>
                        <UserX /> Disable account
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }
    );
    return cols;
  }, [platformScoped, isSuperAdmin, m.resendVerification, m.enable]);

  const runBulk = async (users: UserRow[], fn: (u: UserRow) => Promise<unknown>) => {
    // Sequential so "last admin" guards evaluate against up-to-date state.
    for (const u of users) await fn(u);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          listScope === ALL_PLATFORMS
            ? 'Every account across all platforms.'
            : `Members of ${platform?.name ?? 'this platform'} and their access.`
        }
        actions={
          <>
            {isSuperAdmin && scope !== ALL_PLATFORMS && (
              <RangeTabs
                value={widen ? 'all' : 'platform'}
                options={[
                  { value: 'platform', label: 'This platform' },
                  { value: 'all', label: 'All users' },
                ]}
                onChange={(v) => {
                  setWiden(v === 'all');
                  setPage(1);
                }}
              />
            )}
            <Button asChild>
              <Link href="/admin/invites?new=1"><UserPlus /> Invite user</Link>
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading || isFetching}
          onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
          selectable={platformScoped}
          pagination={data && { page, pageSize: PAGE_SIZE, total: data.total, onPageChange: setPage }}
          toolbar={
            <>
              <ToolbarSearch value={search} onChange={resetPage(setSearch)} placeholder="Search by email…" />
              <Select value={status} onValueChange={resetPage(setStatus)}>
                <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
              {platformScoped && (
                <Select value={role} onValueChange={resetPage(setRole)}>
                  <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any role</SelectItem>
                    <SelectItem value="ADMIN">Admins</SelectItem>
                    <SelectItem value="USER">Members</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {listScope === ALL_PLATFORMS && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> All platforms
                </span>
              )}
            </>
          }
          bulkActions={(selected, clear) => (
            <>
              <Button size="sm" variant="outline" onClick={() => setPending({ kind: 'role', users: selected, role: 'ADMIN' })}>
                <Shield /> Make admin
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPending({ kind: 'role', users: selected, role: 'USER' })}>
                <ShieldOff /> Make member
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  setPending({ kind: 'remove', users: selected });
                  clear();
                }}
              >
                <UserMinus /> Remove
              </Button>
            </>
          )}
          empty={
            <EmptyState
              icon={Users}
              title={q || status !== 'any' || role !== 'any' ? 'No users match these filters' : 'No users yet'}
              description={q ? `Nothing found for “${q}”.` : 'Invite someone to get started.'}
            />
          }
        />
      )}

      <ConfirmDialog
        open={pending?.kind === 'remove'}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.kind === 'remove' && pending.users.length > 1 ? `Remove ${pending.users.length} users?` : 'Remove user from platform?'}
        description={
          pending?.kind === 'remove' && (
            <>
              {pending.users.length === 1 ? <strong className="text-foreground">{pending.users[0].email}</strong> : 'They'} will lose access to{' '}
              {platform?.name ?? 'this platform'}. Their account and access to other platforms are unaffected.
            </>
          )
        }
        confirmLabel="Remove"
        onConfirm={() =>
          pending?.kind === 'remove' &&
          runBulk(pending.users, (u) => m.remove.mutateAsync({ userId: u.id, platformId: scope, email: u.email }))
        }
      />

      <ConfirmDialog
        open={pending?.kind === 'role'}
        onOpenChange={(o) => !o && setPending(null)}
        destructive={false}
        title={pending?.kind === 'role' ? (pending.role === 'ADMIN' ? 'Grant admin access?' : 'Remove admin access?') : ''}
        description={
          pending?.kind === 'role' &&
          (pending.role === 'ADMIN'
            ? `${pending.users.length === 1 ? pending.users[0].email : `${pending.users.length} users`} will be able to manage members, invites and settings of ${platform?.name ?? 'this platform'}.`
            : `${pending.users.length === 1 ? pending.users[0].email : `${pending.users.length} users`} will become regular members.`)
        }
        confirmLabel={pending?.kind === 'role' && pending.role === 'ADMIN' ? 'Make admin' : 'Make member'}
        onConfirm={() =>
          pending?.kind === 'role' &&
          runBulk(pending.users, (u) =>
            m.changeRole.mutateAsync({ userId: u.id, platformId: scope, role: pending.role, email: u.email })
          )
        }
      />

      {pending?.kind === 'disable' && (
        <DisableUserDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          email={pending.user.email}
          onConfirm={(reason) => m.disable.mutateAsync({ userId: pending.user.id, reason })}
        />
      )}
    </div>
  );
}
