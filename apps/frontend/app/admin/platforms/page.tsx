'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Globe, Link2, Loader2, Lock, Plus, Search, Unlock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminSession } from '../admin-session-context';
import { useAdminMutation, usePlatforms, type PlatformSummary } from '@/lib/admin-api';
import { apiJson } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, StatusPill } from '@/components/admin/primitives';
import { formatDate } from '@/components/admin/format';

function CreatePlatformDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selfReg, setSelfReg] = useState(false);
  const create = useAdminMutation(
    () => apiJson<{ id: string; name: string }>('/api/admin/platforms', { method: 'POST', body: { name, description, allowSelfRegistration: selfReg } }),
    { success: (p) => `Platform “${p.name}” created` }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const p = await create.mutateAsync();
              onOpenChange(false);
              setName('');
              setDescription('');
              setSelfReg(false);
              router.push(`/admin/platforms/${p.id}`);
            } catch {
              // Toasted.
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Create platform</DialogTitle>
            <DialogDescription>A platform is one app that signs users in through Vyntrise. You become its first admin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Review Rise SMS" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this app for?" />
          </div>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Allow self-registration</span>
              <span className="block text-xs text-muted-foreground">Anyone with the sign-up link can create an account.</span>
            </span>
            <Switch checked={selfReg} onCheckedChange={setSelfReg} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Create platform
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlatformCard({ p, current }: { p: PlatformSummary; current: boolean }) {
  return (
    <Link
      href={`/admin/platforms/${p.id}`}
      className="glass group relative flex flex-col overflow-hidden rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_40px_-16px_hsl(var(--primary)/0.45)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-muted text-base font-semibold uppercase">{p.name[0]}</div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="truncate font-semibold">{p.name}</h3>
        {current && <StatusPill tone="brand">Selected</StatusPill>}
      </div>
      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{p.description || 'No description'}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{p.userCount} members</span>
        <span className="inline-flex items-center gap-1.5">
          {p.allowSelfRegistration ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {p.allowSelfRegistration ? 'Open sign-up' : 'Invite only'}
        </span>
        <span className="inline-flex items-center gap-1.5" title={p.redirectUriCount ? undefined : 'Using the legacy *.vyntrise.com redirect rule'}>
          <Link2 className="h-3.5 w-3.5" />
          {p.redirectUriCount ? `${p.redirectUriCount} redirect URI${p.redirectUriCount === 1 ? '' : 's'}` : <span className="text-warning">No redirect URIs</span>}
        </span>
        <span className="ml-auto">{formatDate(p.createdAt)}</span>
      </div>
    </Link>
  );
}

function PlatformsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { isSuperAdmin, scope } = useAdminSession();
  const { data, isLoading, isError, error, refetch } = usePlatforms();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const open = createOpen || (isSuperAdmin && params.get('new') === '1');

  const rows = (data ?? []).filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platforms"
        description={isSuperAdmin ? 'Every app that signs users in through Vyntrise.' : 'Apps you administer.'}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter platforms…" className="h-9 w-56 pl-8" />
            </div>
            {isSuperAdmin && (
              <Button onClick={() => setCreateOpen(true)}><Plus /> New platform</Button>
            )}
          </>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl">
          <EmptyState
            icon={Globe}
            title={search ? 'No platforms match' : 'No platforms yet'}
            description={search ? undefined : isSuperAdmin ? 'Create the first app that will sign users in through Vyntrise.' : 'Ask a super-admin to create one.'}
            action={!search && isSuperAdmin ? <Button onClick={() => setCreateOpen(true)}><Plus /> New platform</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => <PlatformCard key={p.id} p={p} current={p.id === scope} />)}
        </div>
      )}

      {isSuperAdmin && (
        <CreatePlatformDialog
          open={open}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o && params.get('new')) router.replace(pathname, { scroll: false });
          }}
        />
      )}
    </div>
  );
}

export default function PlatformsPage() {
  return (
    <Suspense>
      <PlatformsView />
    </Suspense>
  );
}
