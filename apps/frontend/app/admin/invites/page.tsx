'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isPast } from 'date-fns';
import { Check, Copy, Link2, Loader2, Mail, MailPlus, Shield, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminSession } from '../admin-session-context';
import { useAdminMutation, useInvites, type Invite, type Role } from '@/lib/admin-api';
import { apiJson, ApiError } from '@/lib/api';
import { DataTable, ToolbarSearch, type ColumnDef } from '@/components/admin/data-table';
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, StatusPill } from '@/components/admin/primitives';
import { RangeTabs } from '@/components/admin/charts';
import { Avatar, RelativeTime, formatDateTime } from '@/components/admin/format';
import { RequirePlatform } from '@/components/admin/require-platform';

type InviteStatus = 'pending' | 'accepted' | 'expired';

function statusOf(i: Invite): InviteStatus {
  if (i.isUsed) return 'accepted';
  return isPast(new Date(i.expiresAt)) ? 'expired' : 'pending';
}

function InviteStatusPill({ status }: { status: InviteStatus }) {
  if (status === 'accepted') return <StatusPill tone="good">Accepted</StatusPill>;
  if (status === 'expired') return <StatusPill tone="neutral">Expired</StatusPill>;
  return <StatusPill tone="brand">Pending</StatusPill>;
}

type CreateResult = { granted: boolean; registerLink: string | null; message: string };

function InviteDialog({ open, onOpenChange, platformId, platformName }: { open: boolean; onOpenChange: (o: boolean) => void; platformId: string; platformName: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('USER');
  const [result, setResult] = useState<(CreateResult & { email: string }) | null>(null);
  const [inlineError, setInlineError] = useState('');
  const [copied, setCopied] = useState(false);

  const create = useAdminMutation(
    (vars: { email: string; role: Role }) =>
      apiJson<CreateResult>('/api/admin/invites', { method: 'POST', body: { ...vars, platformId } }),
    { silent: true }
  );

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setEmail('');
      setRole('USER');
      setResult(null);
      setInlineError('');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError('');
    try {
      const r = await create.mutateAsync({ email: email.trim(), role });
      setResult({ ...r, email: email.trim() });
      toast.success(r.granted ? `${email.trim()} now has access` : 'Invitation created');
    } catch (err) {
      // A 409 is the expected answer for "already invited / already a member": say so inline
      // rather than as an error toast.
      if (err instanceof ApiError && err.status === 409) setInlineError(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-success/10 text-success">
                {result.granted ? <UserCheck className="h-5 w-5" /> : <Check className="h-5 w-5" />}
              </div>
              <DialogTitle>{result.granted ? 'Access granted' : 'Invitation created'}</DialogTitle>
              <DialogDescription>
                {result.granted
                  ? `${result.email} already had an account, so they were added to ${platformName} straight away and notified by email.`
                  : `We emailed ${result.email} a link to join ${platformName}. You can also share it directly — it expires in 7 days.`}
              </DialogDescription>
            </DialogHeader>
            {result.registerLink && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <Link2 className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <code className="min-w-0 flex-1 truncate text-xs">{result.registerLink}</code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.registerLink!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResult(null); setEmail(''); }}>Invite another</Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Invite to {platformName}</DialogTitle>
              <DialogDescription>Existing accounts get access immediately; new addresses receive a sign-up link.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input id="invite-email" type="email" required autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setInlineError(''); }} placeholder="name@company.com" />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['USER', 'ADMIN'] as Role[]).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-lg border p-3 text-left transition-colors ${role === r ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {r === 'ADMIN' ? <Shield className="h-4 w-4 text-primary" /> : <Mail className="h-4 w-4 text-muted-foreground" />}
                      {r === 'ADMIN' ? 'Admin' : 'Member'}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r === 'ADMIN' ? 'Manages members, invites and settings' : 'Can sign in to the platform'}</p>
                  </button>
                ))}
              </div>
            </div>
            {inlineError && (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{inlineError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="animate-spin" /> : <MailPlus />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvitesView({ platformId }: { platformId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { platform } = useAdminSession();
  const { data, isLoading, isError, error, refetch } = useInvites(platformId);
  const [tab, setTab] = useState<InviteStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // ?new=1 (from the command palette) opens the dialog on arrival.
  const open = dialogOpen || params.get('new') === '1';
  const setOpen = (o: boolean) => {
    setDialogOpen(o);
    if (!o && params.get('new')) router.replace(pathname, { scroll: false });
  };

  const revoke = useAdminMutation(
    (invite: Invite) => apiJson(`/api/admin/invites/${invite.id}?platformId=${platformId}`, { method: 'DELETE' }),
    { success: (_r, v) => `Invitation for ${v.email} revoked` }
  );

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, expired: 0, all: data?.length ?? 0 };
    for (const i of data ?? []) c[statusOf(i)]++;
    return c;
  }, [data]);

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (i) => (tab === 'all' || statusOf(i) === tab) && (!search || i.email.toLowerCase().includes(search.toLowerCase()))
      ),
    [data, tab, search]
  );

  const columns: ColumnDef<Invite, unknown>[] = [
    {
      accessorKey: 'email',
      header: 'Invitee',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar email={row.original.email} />
          <span className="font-medium">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (row.original.role === 'ADMIN' ? <StatusPill tone="brand">Admin</StatusPill> : <span className="text-muted-foreground">Member</span>),
    },
    { id: 'status', header: 'Status', accessorFn: statusOf, cell: ({ row }) => <InviteStatusPill status={statusOf(row.original)} /> },
    { accessorKey: 'createdAt', header: 'Sent', cell: ({ row }) => <RelativeTime value={row.original.createdAt} className="text-muted-foreground" /> },
    {
      accessorKey: 'expiresAt',
      header: 'Expires',
      cell: ({ row }) => <span className="text-muted-foreground" title={formatDateTime(row.original.expiresAt)}><RelativeTime value={row.original.expiresAt} /></span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        !row.original.isUsed && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setRevoking(row.original)}>
              <X /> Revoke
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitations"
        description={`People invited to ${platform?.name ?? 'this platform'}. Pending invites expire after 7 days.`}
        actions={<Button onClick={() => setOpen(true)}><MailPlus /> Invite user</Button>}
      />

      <RangeTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: `Pending · ${counts.pending}` },
          { value: 'accepted', label: `Accepted · ${counts.accepted}` },
          { value: 'expired', label: `Expired · ${counts.expired}` },
          { value: 'all', label: `All · ${counts.all}` },
        ]}
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          toolbar={<ToolbarSearch value={search} onChange={setSearch} placeholder="Search invitees…" />}
          empty={
            <EmptyState
              icon={Mail}
              title={search ? 'No matching invitations' : tab === 'pending' ? 'No pending invitations' : 'Nothing here'}
              description={tab === 'pending' && !search ? 'Invite teammates and they will show up here until they accept.' : undefined}
              action={tab === 'pending' && !search ? <Button variant="outline" onClick={() => setOpen(true)}><MailPlus /> Invite user</Button> : undefined}
            />
          }
        />
      )}

      <InviteDialog open={open} onOpenChange={setOpen} platformId={platformId} platformName={platform?.name ?? 'this platform'} />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke invitation?"
        description={revoking && `The link sent to ${revoking.email} stops working immediately. You can invite them again later.`}
        confirmLabel="Revoke"
        onConfirm={() => revoking && revoke.mutateAsync(revoking)}
      />
    </div>
  );
}

export default function InvitesPage() {
  return (
    <Suspense>
      <RequirePlatform what="Invitations">{(platformId) => <InvitesView key={platformId} platformId={platformId} />}</RequirePlatform>
    </Suspense>
  );
}
