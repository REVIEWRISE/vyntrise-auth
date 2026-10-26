'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/admin/primitives';
import { IC } from '@/components/admin/code-block';
import { apiJson, qs } from '@/lib/api';
import type { PlatformDetail } from '@/lib/admin-api';
import { usePlatformUpdate } from './shared';

// Client-side pre-check mirroring the server's rules, for instant feedback. The server's
// validation is the one that counts.
function localError(value: string, kind: 'redirect' | 'origin'): string | null {
  if (value.includes('*')) return 'Wildcards are not allowed';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Not a valid absolute URL';
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return 'Must use https (http only for localhost)';
  if (url.username || url.password) return 'Must not contain credentials';
  if (url.search || url.hash) return 'Must not contain a query string or fragment';
  if (kind === 'origin' && url.pathname !== '/') return 'An origin has no path, e.g. https://app.example.com';
  return null;
}

function ListEditor({
  label,
  description,
  placeholder,
  kind,
  values,
  onChange,
}: {
  label: string;
  description: React.ReactNode;
  placeholder: string;
  kind: 'redirect' | 'origin';
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const error = draft ? localError(draft.trim(), kind) : null;
  const add = () => {
    // Origins are compared exactly against the browser's Origin header, which has no slash.
    const v = kind === 'origin' ? draft.trim().replace(/\/$/, '') : draft.trim();
    if (!v || error) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  };

  return (
    <Panel>
      <PanelHeader title={label} description={description} />
      <div className="space-y-3 px-5 pb-5">
        {values.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {values.map((v) => (
              <li key={v} className="group flex items-center gap-3 px-3 py-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.startsWith('http:') ? 'bg-warning' : 'bg-success'}`} aria-hidden />
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{v}</code>
                {v.startsWith('http:') && <span className="text-[11px] text-warning">local dev</span>}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">None configured</p>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="font-mono text-xs"
            aria-invalid={!!error}
          />
          <Button variant="outline" onClick={add} disabled={!draft.trim() || !!error}>
            <Plus /> Add
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Panel>
  );
}

function RedirectTester({ platformId }: { platformId: string }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const test = async () => {
    setBusy(true);
    try {
      const r = await apiJson<{ allowed: boolean }>(`/api/auth/redirect-check${qs({ platformId, redirectUrl: url.trim() })}`);
      setResult(r.allowed);
    } catch {
      setResult(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader icon={FlaskConical} title="Test a redirect" description="Checks a URL against the saved configuration exactly as the login page will." />
      <div className="space-y-3 px-5 pb-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) test();
          }}
        >
          <Input value={url} onChange={(e) => { setUrl(e.target.value); setResult(null); }} placeholder="https://app.example.com/auth/callback" className="font-mono text-xs" />
          <Button type="submit" variant="secondary" disabled={!url.trim() || busy}>
            {busy && <Loader2 className="animate-spin" />} Test
          </Button>
        </form>
        {result !== null && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm animate-in fade-in-0 ${result ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
            {result ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result ? 'Allowed — the login page will redirect here with a token.' : 'Rejected — users will land on the console instead.'}
          </div>
        )}
      </div>
    </Panel>
  );
}

export function SecurityTab({ platform }: { platform: PlatformDetail }) {
  const update = usePlatformUpdate(platform.id);
  const [redirectUris, setRedirectUris] = useState(platform.redirectUris);
  const [allowedOrigins, setAllowedOrigins] = useState(platform.allowedOrigins);
  const dirty =
    redirectUris.join('\n') !== platform.redirectUris.join('\n') ||
    allowedOrigins.join('\n') !== platform.allowedOrigins.join('\n');

  return (
    <div className="space-y-4">
      {platform.redirectUris.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">No redirect URIs yet.</span>{' '}
            <span className="text-muted-foreground">
              This platform falls back to the legacy rule (any <IC>https://*.vyntrise.com</IC> host, plus localhost in development).
              Register your callback URLs so that fallback can be switched off.
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ListEditor
          label="Redirect URIs"
          kind="redirect"
          description={<>Where the login page may send a signed-in user with their token. A URL matches if it has the same origin and its path is at or below one listed here.</>}
          placeholder="https://app.example.com/auth/callback"
          values={redirectUris}
          onChange={setRedirectUris}
        />
        <ListEditor
          label="Allowed origins (CORS)"
          kind="origin"
          description={<>Browser origins that may call the auth API with credentials, in addition to the server&apos;s <IC>ALLOWED_ORIGINS</IC>.</>}
          placeholder="https://app.example.com"
          values={allowedOrigins}
          onChange={setAllowedOrigins}
        />
      </div>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3">
        {dirty && <span className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur animate-in fade-in-0">Unsaved changes</span>}
        {dirty && (
          <Button variant="outline" onClick={() => { setRedirectUris(platform.redirectUris); setAllowedOrigins(platform.allowedOrigins); }}>
            Discard
          </Button>
        )}
        <Button disabled={!dirty || update.isPending} onClick={() => update.mutate({ redirectUris, allowedOrigins })}>
          {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save security settings
        </Button>
      </div>

      <RedirectTester platformId={platform.id} />
    </div>
  );
}
