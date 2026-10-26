'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/admin/primitives';
import { CodeBlock, IC } from '@/components/admin/code-block';
import { CopyButton } from '@/components/copy-button';
import type { PlatformDetail } from '@/lib/admin-api';
import { AUTH_BASE } from './shared';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <span className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-border last:hidden" aria-hidden />
      <span className="z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-card text-xs font-semibold text-primary">{n}</span>
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="font-medium">{title}</h3>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

// The platform-specific quick start; the full guide lives at /admin/docs.
export function IntegrateTab({ platform }: { platform: PlatformDetail }) {
  const callback = platform.redirectUris[0] ?? 'https://yourapp.vyntrise.com/auth/callback';
  const loginUrl = `${AUTH_BASE}/login?platformId=${platform.id}&redirectUrl=${callback}`;

  const endpoints = [
    { method: 'GET', path: `/login?platformId=${platform.id}&redirectUrl=…`, desc: 'SSO login entry point' },
    ...(platform.allowSelfRegistration ? [{ method: 'GET', path: `/register?platformId=${platform.id}`, desc: 'Self-registration entry point' }] : []),
    { method: 'GET', path: '/api/account/me', desc: 'User profile and platform roles' },
    { method: 'POST', path: '/api/auth/refresh', desc: 'Refresh the access token (cookie)' },
    { method: 'POST', path: '/api/auth/logout', desc: 'End the session' },
    ...(platform.inviteKey ? [{ method: 'POST', path: `/api/admin/platforms/${platform.id}/invites`, desc: 'Create an invitation (invite key)' }] : []),
    { method: 'GET', path: '/.well-known/jwks.json', desc: 'Public keys for verifying tokens' },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Panel className="p-6">
        <ol>
          <Step n={1} title="Register your callback">
            <p>
              Add your app&apos;s callback URL on the <strong className="text-foreground">Security</strong> tab. The login page only hands tokens to registered URLs.
            </p>
          </Step>
          <Step n={2} title="Redirect signed-out users">
            <CodeBlock lang="url" code={loginUrl} />
          </Step>
          <Step n={3} title="Read the token on your callback">
            <p>The user returns to your callback with <IC>?token=eyJhbGci…</IC> appended. Store it and continue.</p>
          </Step>
          <Step n={4} title="Verify tokens locally">
            <p>Tokens are RS256-signed; verify them against the published keys — no shared secret, no round trip.</p>
            <CodeBlock
              lang="typescript"
              code={`import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('${AUTH_BASE}/.well-known/jwks.json'));

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: '${AUTH_BASE}' });
  return payload; // throws if signature, issuer or expiry is bad
}`}
            />
          </Step>
        </ol>
        <Link href="/admin/docs" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          Full integration guide <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Panel>

      <Panel className="h-fit">
        <PanelHeader title="Endpoint reference" />
        <ul className="divide-y border-t">
          {endpoints.map((e) => (
            <li key={e.path} className="flex items-start gap-3 px-5 py-3">
              <span className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${e.method === 'GET' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{e.method}</span>
              <div className="min-w-0 flex-1">
                <code className="block break-all font-mono text-xs">{e.path}</code>
                <span className="text-xs text-muted-foreground">{e.desc}</span>
              </div>
              <CopyButton text={`${AUTH_BASE}${e.path}`} label="" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
