'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Code2, KeyRound, Link2, Settings, ShieldCheck, Trash2, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminSession } from '../../admin-session-context';
import { useAdminMutation, usePlatform } from '@/lib/admin-api';
import { apiJson } from '@/lib/api';
import { ConfirmDialog, ErrorState, Panel, PanelHeader, StatusPill } from '@/components/admin/primitives';
import { formatDate } from '@/components/admin/format';
import { GeneralTab } from './_components/general-tab';
import { SecurityTab } from './_components/security-tab';
import { KeysTab } from './_components/keys-tab';
import { IntegrateTab } from './_components/integrate-tab';

export default function PlatformDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSuperAdmin, setScope } = useAdminSession();
  const { data: platform, isLoading, isError, error, refetch } = usePlatform(id);
  const [deleting, setDeleting] = useState(false);

  const remove = useAdminMutation(
    () => apiJson(`/api/admin/platforms/${id}`, { method: 'DELETE', body: { confirmName: platform?.name } }),
    { success: `Platform deleted` }
  );

  const back = (
    <Link href="/admin/platforms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> All platforms
    </Link>
  );

  if (isError) return <div className="space-y-4">{back}<ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (isLoading || !platform) {
    return (
      <div className="space-y-6">
        {back}
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-xl font-semibold uppercase text-white shadow-[0_8px_30px_-8px_hsl(var(--accent-via)/0.6)]">
            {platform.name[0]}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{platform.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{platform.userCount} members</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />Created {formatDate(platform.createdAt)}</span>
              {platform.redirectUris.length === 0 && <StatusPill tone="warn">Legacy redirects</StatusPill>}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setScope(platform.id);
            router.push('/admin/users');
          }}
        >
          <Users /> View members
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Settings /> General</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck /> Security</TabsTrigger>
          <TabsTrigger value="keys"><KeyRound /> API keys</TabsTrigger>
          <TabsTrigger value="integrate"><Code2 /> Integrate</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="danger"><TriangleAlert /> Danger zone</TabsTrigger>}
        </TabsList>

        {/* Keyed on updatedAt-ish fields so forms re-seed after a save elsewhere. */}
        <TabsContent value="general"><GeneralTab key={`${platform.name}|${platform.description}`} platform={platform} /></TabsContent>
        <TabsContent value="security"><SecurityTab key={[...platform.redirectUris, '|', ...platform.allowedOrigins].join(',')} platform={platform} /></TabsContent>
        <TabsContent value="keys"><KeysTab platform={platform} /></TabsContent>
        <TabsContent value="integrate"><IntegrateTab platform={platform} /></TabsContent>
        {isSuperAdmin && (
          <TabsContent value="danger">
            <Panel className="border-destructive/30">
              <PanelHeader icon={Trash2} title="Delete this platform" description="Permanent. Every membership, invitation and invite key goes with it; the audit trail is kept." />
              <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Users className="h-4 w-4" />{platform.userCount} members lose access immediately</li>
                  <li className="flex items-center gap-2"><Link2 className="h-4 w-4" />Sign-ins with this platform ID start failing</li>
                </ul>
                <Button variant="destructive" onClick={() => setDeleting(true)}>
                  <Trash2 /> Delete platform
                </Button>
              </div>
            </Panel>
          </TabsContent>
        )}
      </Tabs>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${platform.name}?`}
        description="This cannot be undone."
        confirmText={platform.name}
        confirmLabel="Delete forever"
        onConfirm={async () => {
          await remove.mutateAsync();
          router.push('/admin/platforms');
        }}
      />
    </div>
  );
}
