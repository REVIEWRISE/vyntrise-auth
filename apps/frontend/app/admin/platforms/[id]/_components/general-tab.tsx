'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/admin/primitives';
import { CodeBlock } from '@/components/admin/code-block';
import { CopyButton } from '@/components/copy-button';
import type { PlatformDetail } from '@/lib/admin-api';
import { AUTH_BASE, usePlatformUpdate } from './shared';

export function GeneralTab({ platform }: { platform: PlatformDetail }) {
  const update = usePlatformUpdate(platform.id);
  const [name, setName] = useState(platform.name);
  const [description, setDescription] = useState(platform.description ?? '');
  const dirty = name.trim() !== platform.name || (description.trim() || null) !== platform.description;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Profile" description="How this platform appears in the console and in emails." />
          <form
            className="grid gap-4 px-5 pb-5"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({ name: name.trim(), description: description.trim() || null });
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="g-name">Name</Label>
              <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="g-desc">Description</Label>
              <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this app for?" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!dirty || update.isPending}>
                {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
              </Button>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Self-registration" description="Whether people can create their own account on this platform." />
          <div className="space-y-3 px-5 pb-5">
            <label className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <span className="text-sm">
                {platform.allowSelfRegistration
                  ? 'Open — anyone with the sign-up link can create an account, then confirm their email before signing in.'
                  : 'Closed — new users must be invited by an admin.'}
              </span>
              <Switch
                checked={platform.allowSelfRegistration}
                disabled={update.isPending}
                onCheckedChange={(v) => update.mutate({ allowSelfRegistration: v })}
                aria-label="Allow self-registration"
              />
            </label>
            {platform.allowSelfRegistration && <CodeBlock lang="sign-up link" code={`${AUTH_BASE}/register?platformId=${platform.id}`} />}
          </div>
        </Panel>
      </div>

      <Panel className="h-fit">
        <PanelHeader title="Identifiers" />
        <dl className="space-y-4 px-5 pb-5 text-sm">
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Platform ID</dt>
            <dd className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border bg-muted/40 px-2 py-1 font-mono text-xs">{platform.id}</code>
              <CopyButton text={platform.id} label="" />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Login URL</dt>
            <dd className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border bg-muted/40 px-2 py-1 font-mono text-xs">{`${AUTH_BASE}/login?platformId=${platform.id}`}</code>
              <CopyButton text={`${AUTH_BASE}/login?platformId=${platform.id}`} label="" />
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
