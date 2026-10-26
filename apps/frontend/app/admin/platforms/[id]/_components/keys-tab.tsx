'use client';

import { useState } from 'react';
import { AlertTriangle, History, KeyRound, Loader2, RefreshCw, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog, EmptyState, Panel, PanelHeader, StatusPill } from '@/components/admin/primitives';
import { CodeBlock, IC } from '@/components/admin/code-block';
import { CopyButton } from '@/components/copy-button';
import { RelativeTime, formatDate } from '@/components/admin/format';
import { apiJson } from '@/lib/api';
import { useAdminMutation, useInviteKeyHistory, type InviteKeyMeta, type PlatformDetail } from '@/lib/admin-api';
import { AUTH_BASE } from './shared';

export function KeysTab({ platform }: { platform: PlatformDetail }) {
  const history = useInviteKeyHistory(platform.id);
  // Held in memory only: the raw key is returned once and can never be fetched again.
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'rotate' | 'revoke'>(null);

  const issue = useAdminMutation(
    () => apiJson<{ rawKey: string; key: InviteKeyMeta }>(`/api/admin/platforms/${platform.id}/invite-key`, { method: 'POST' }),
    { silent: true }
  );
  const revoke = useAdminMutation(() => apiJson(`/api/admin/platforms/${platform.id}/invite-key`, { method: 'DELETE' }), {
    success: 'Invite key revoked',
  });

  const generate = async () => {
    const r = await issue.mutateAsync();
    setFresh(r.rawKey);
  };

  const key = platform.inviteKey;

  return (
    <div className="space-y-4">
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <PanelHeader
          icon={KeyRound}
          title="Invite API key"
          description={
            <>
              Lets {platform.name}&apos;s backend create invitations directly. Scoped to this platform and the <IC>USER</IC> role only — not an admin credential.
            </>
          }
        />
        <div className="relative flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
          {key ? (
            <div className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl border bg-muted">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm">{key.prefix}<span className="text-muted-foreground">••••••••••••</span></code>
                  <StatusPill tone="good">Live</StatusPill>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Issued {formatDate(key.createdAt)} · {key.lastUsedAt ? <>last used <RelativeTime value={key.lastUsedAt} /></> : 'never used'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No key issued. This platform cannot create invitations programmatically.</p>
          )}
          <div className="flex gap-2">
            {key && (
              <Button variant="outline" onClick={() => setConfirm('revoke')}>
                <ShieldOff /> Revoke
              </Button>
            )}
            <Button onClick={() => (key ? setConfirm('rotate') : generate().catch(() => {}))} disabled={issue.isPending}>
              {issue.isPending ? <Loader2 className="animate-spin" /> : key ? <RefreshCw /> : <KeyRound />}
              {key ? 'Rotate key' : 'Generate key'}
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader icon={History} title="Key history" description="Every key this platform has had. Revoked keys are kept for the audit trail." />
          {history.data && history.data.length > 0 ? (
            <ul className="divide-y border-t">
              {history.data.map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <code className="font-mono text-xs">{k.prefix}…</code>
                  {k.revokedAt ? <StatusPill tone="neutral">Revoked</StatusPill> : <StatusPill tone="good">Live</StatusPill>}
                  <span className="ml-auto text-right text-xs text-muted-foreground">
                    {k.createdByEmail ?? 'unknown'} · {formatDate(k.createdAt)}
                    {k.revokedAt && <> → {formatDate(k.revokedAt)}</>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={History} title="No keys yet" className="py-8" />
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Using the key" description="Call from your server. Rate limited to 20/min, 200/h, and 5/h per address." />
          <div className="px-5 pb-3">
            <CodeBlock
              lang="typescript"
              code={`await fetch('${AUTH_BASE}/api/admin/platforms/${platform.id}/invites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${process.env.VYNTRISE_INVITE_KEY}\`,
  },
  body: JSON.stringify({ email: 'newuser@example.com' }),
});
// 201 granted:false → invitation emailed   201 granted:true → existing account added
// 409 already invited / already a member (treat as success)   401 bad or revoked key`}
            />
          </div>
        </Panel>
      </div>

      <Dialog open={!!fresh} onOpenChange={(o) => !o && setFresh(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Copy your new invite key</DialogTitle>
            <DialogDescription>This is the only time it will be shown. Store it as a secret in {platform.name}&apos;s environment.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{fresh}</code>
            {fresh && <CopyButton text={fresh} />}
          </div>
          <DialogFooter>
            <Button onClick={() => setFresh(null)}>I&apos;ve stored it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm === 'rotate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Rotate the invite key?"
        description="A new key is issued and the current one stops working immediately. Deploy the new value straight away, or invite calls will start failing."
        confirmLabel="Rotate key"
        onConfirm={generate}
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Revoke the invite key?"
        description={`${platform.name} will no longer be able to create invitations programmatically until a new key is generated.`}
        confirmLabel="Revoke key"
        onConfirm={() => revoke.mutateAsync()}
      />
    </div>
  );
}
