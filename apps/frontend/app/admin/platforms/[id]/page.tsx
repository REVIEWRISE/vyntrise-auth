'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Calendar, Zap, Key, RefreshCw, Shield, BookOpen, UserPlus, Loader2, MailCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { CopyButton } from '@/components/copy-button';

interface Platform {
  id: string;
  name: string;
  description: string | null;
  allowSelfRegistration: boolean;
  createdAt: string;
  userCount: number;
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 overflow-hidden my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-xs text-zinc-500 font-mono">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-4 border-b border-zinc-800/50 last:border-0">
      <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-200 mb-2">{title}</p>
        <div className="text-sm text-zinc-400 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function IC({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/50 text-xs font-mono text-indigo-300">{children}</code>;
}

export default function PlatformDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingSelfReg, setTogglingSelfReg] = useState(false);

  const toggleSelfRegistration = async () => {
    if (!platform) return;
    setTogglingSelfReg(true);
    try {
      const res = await apiFetch(`/api/admin/platforms/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ allowSelfRegistration: !platform.allowSelfRegistration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update platform');
      setPlatform(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTogglingSelfReg(false);
    }
  };

  useEffect(() => {
    apiFetch(`/api/admin/platforms/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load platform');
        }
        return r.json();
      })
      .then((found: Platform) => setPlatform(found))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-zinc-400 p-8">Loading...</div>;
  if (error || !platform) return (
    <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error || 'Not found'}</div>
  );

  const AUTH_BASE = 'https://auth.vyntrise.com';
  const loginUrl = `${AUTH_BASE}/login?platformId=${platform.id}&redirectUrl=https://yourapp.vyntrise.com/auth/callback`;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push('/admin/platforms')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Platforms
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">{platform.name}</h1>
            {platform.description && (
              <p className="text-zinc-400 mt-1">{platform.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            <div className="flex items-center gap-1.5 text-sm text-zinc-400">
              <Users className="h-4 w-4" />
              {platform.userCount} members
            </div>
            <div className="flex items-center gap-1.5 text-sm text-zinc-400">
              <Calendar className="h-4 w-4" />
              {new Date(platform.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Platform ID badge */}
        <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 w-fit">
          <span className="text-xs text-zinc-500 font-medium">Platform ID</span>
          <code className="text-sm font-mono text-zinc-200">{platform.id}</code>
          <CopyButton text={platform.id} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Overview */}
      <div>
        <SectionHeader icon={BookOpen} title="Integration Overview" color="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400" />
        <p className="text-sm text-zinc-400 mb-4">
          Connect any external app to Vyntrise Auth using this platform. Users are redirected to{' '}
          <IC>auth.vyntrise.com</IC> for authentication, then returned to your app with a signed JWT.
        </p>
        <div className="flex items-center gap-2 flex-wrap p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm">
          <div className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs">User visits yourapp.vyntrise.com</div>
          <span className="text-zinc-600">→</span>
          <div className="px-3 py-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs">auth.vyntrise.com/login</div>
          <span className="text-zinc-600">→</span>
          <div className="px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-300 font-mono text-xs">yourapp.vyntrise.com/callback?token=...</div>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          <IC>redirectUrl</IC> must be an <IC>https://*.vyntrise.com</IC> subdomain — the login
          page rejects any other host (and any non-<IC>https:</IC> scheme) before it will attach
          a token and redirect there.
        </div>
      </div>

      {/* Self-registration */}
      <div>
        <SectionHeader icon={UserPlus} title="Self-Registration" color="bg-teal-500/10 border border-teal-500/20 text-teal-400" />
        <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <div>
            <p className="text-sm text-zinc-300">
              {platform.allowSelfRegistration
                ? 'Anyone with the sign-up link below can create an account, then confirm their email before signing in.'
                : 'Closed — new users must be invited by an admin.'}
            </p>
          </div>
          <Button
            onClick={toggleSelfRegistration}
            disabled={togglingSelfReg}
            variant={platform.allowSelfRegistration ? 'outline' : 'default'}
            className={platform.allowSelfRegistration
              ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              : 'bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold'}
          >
            {togglingSelfReg
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : platform.allowSelfRegistration ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {platform.allowSelfRegistration && (
          <div className="mt-3">
            <CodeBlock lang="url" code={`${AUTH_BASE}/register?platformId=${platform.id}`} />
          </div>
        )}
      </div>

      {/* Email confirmation */}
      <div>
        <SectionHeader icon={MailCheck} title="Email Confirmation" color="bg-sky-500/10 border border-sky-500/20 text-sky-400" />
        <p className="text-sm text-zinc-400 mb-2">
          Self-registered accounts start unconfirmed and <strong className="text-zinc-200">cannot sign
          in</strong> until the address is proven. Invited users skip this — receiving the invitation
          already proves they read that mailbox. Changing an account&apos;s email also clears its
          confirmed state, so an existing user can land here too.
        </p>
        <div className="mb-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-sm text-zinc-400">
          <strong className="text-zinc-200">Using the redirect flow below? There is nothing to
          build here.</strong> The user signs in on <IC>auth.vyntrise.com</IC>, which shows the
          error and a resend link itself. An unconfirmed user never reaches your callback, so your
          app only ever receives tokens for confirmed accounts.
        </div>
        <p className="text-sm text-zinc-400 mb-2">
          The rest of this section applies only if your app posts credentials to{' '}
          <IC>/api/auth/login</IC> directly instead of redirecting. In that case sign-in on an
          unconfirmed account returns <IC>403</IC> with a code to branch on. Handle it separately
          from <IC>401</IC> — refreshing the token will not fix it.
        </p>
        <CodeBlock lang="typescript" code={`if (res.status === 403) {
  const data = await res.json().catch(() => ({}));
  if (data.code === 'EMAIL_NOT_VERIFIED') {
    // Not a permissions problem — the account exists but is unconfirmed.
    window.location.href = '/check-your-email';
    return;
  }
}

// Ask for a fresh link if the first one expired (24h) or was lost
await fetch('${AUTH_BASE}/api/auth/resend-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});`} />
        <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          Resending is capped at <strong>5 per 15 minutes</strong> per address and{' '}
          <strong>5 per hour</strong> per address overall — it triggers outbound mail from our
          domain without authentication. Do not retry it in a loop; surface the failure instead.
          The response is deliberately identical whether or not the address exists, so a{' '}
          <IC>200</IC> is not confirmation that mail was sent.
        </div>
      </div>

      {/* Step 1 */}
      <div>
        <SectionHeader icon={Zap} title="Step 1 — Redirect Unauthenticated Users" color="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400" />
        <p className="text-sm text-zinc-400 mb-2">
          When a user visits your app without a valid session, redirect them to this URL:
        </p>
        <CodeBlock lang="url" code={loginUrl} />
        <p className="text-sm text-zinc-500 mt-1">
          Replace <IC>https://yourapp.vyntrise.com/auth/callback</IC> with your app's actual
          callback URL — it must be an <IC>https://*.vyntrise.com</IC> subdomain, or the login
          page will refuse to redirect there. The <IC>platformId</IC> is pre-filled with this
          platform's ID.
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Example — Next.js middleware redirect</p>
          <CodeBlock lang="typescript" code={`// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('accessToken')?.value
    || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    const loginUrl = new URL('https://auth.vyntrise.com/login');
    loginUrl.searchParams.set('platformId', '${platform.id}');
    // req.nextUrl.origin must be an https://*.vyntrise.com subdomain — the login
    // page rejects any other redirectUrl host.
    loginUrl.searchParams.set('redirectUrl', \`\${req.nextUrl.origin}/auth/callback\`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/app/:path*'] };`} />
        </div>
      </div>

      {/* Step 2 */}
      <div>
        <SectionHeader icon={Key} title="Step 2 — Handle the Callback" color="bg-green-500/10 border border-green-500/20 text-green-400" />
        <p className="text-sm text-zinc-400 mb-2">
          After login, the user lands on your <IC>redirectUrl</IC> with <IC>?token=eyJhbGci...</IC> appended.
          Store the token and redirect to the app.
        </p>
        <CodeBlock lang="typescript" code={`// app/auth/callback/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SsoCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('accessToken', token);
      router.replace('/dashboard');
    } else {
      router.replace('/login?error=no_token');
    }
  }, [params, router]);

  return <p className="p-8 text-center text-zinc-400">Authenticating...</p>;
}`} />
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-4">Verifying the token yourself</p>
        <p className="text-sm text-zinc-400 mb-2">
          Tokens are signed with <IC>RS256</IC>, so your app can verify them locally against the
          published public keys — no shared secret, and no round trip to the auth server on every
          request. Keys rotate, so fetch the JWKS rather than pinning one.
        </p>
        <CodeBlock lang="typescript" code={`import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('${AUTH_BASE}/.well-known/jwks.json'));

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: '${AUTH_BASE}' });
  return payload; // throws if the signature, issuer, or expiry is bad
}`} />
      </div>

      {/* Step 3 */}
      <div>
        <SectionHeader icon={Key} title="Step 3 — Make Authenticated API Calls" color="bg-blue-500/10 border border-blue-500/20 text-blue-400" />
        <p className="text-sm text-zinc-400 mb-2">
          Pass the access token as a <IC>Bearer</IC> header. Use <IC>credentials: 'include'</IC> so cookies
          (refresh token) are sent automatically.
        </p>
        <CodeBlock lang="typescript" code={`// lib/api.ts — reusable fetch helper
export async function authFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('accessToken');

  const res = await fetch(\`https://auth.vyntrise.com\${path}\`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (!refreshed) { window.location.href = '/login'; throw new Error('Session expired'); }
    return authFetch(path, options); // retry once
  }

  return res;
}

// Get the current user
const res = await authFetch('/api/account/me');
const user = await res.json();
// { id, email, platforms: [{ platformId, platformName, role }] }`} />
      </div>

      {/* Step 4 */}
      <div>
        <SectionHeader icon={RefreshCw} title="Step 4 — Refresh Expired Tokens" color="bg-purple-500/10 border border-purple-500/20 text-purple-400" />
        <p className="text-sm text-zinc-400 mb-2">
          Access tokens expire in <strong className="text-zinc-200">15 minutes</strong>.
          Call the refresh endpoint — the refresh token cookie is sent automatically.
        </p>
        <CodeBlock lang="typescript" code={`async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch('${AUTH_BASE}/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    localStorage.setItem('accessToken', accessToken);
    return true;
  } catch {
    return false;
  }
}`} />
        <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          The refresh token cookie is <IC>SameSite=Lax</IC>, so the browser only sends it on
          same-site requests. Cookie-based refresh only works if your app is on a{' '}
          <IC>*.vyntrise.com</IC> subdomain — a fully external domain won't receive the cookie
          and needs a different token-refresh strategy.
        </div>
      </div>

      {/* Step 5 - CORS */}
      <div>
        <SectionHeader icon={Shield} title="Step 5 — Allow Your Origin in CORS" color="bg-orange-500/10 border border-orange-500/20 text-orange-400" />
        <p className="text-sm text-zinc-400 mb-2">
          Add your app's domain to <IC>ALLOWED_ORIGINS</IC> in the auth server's <IC>.env</IC>, then
          recreate the backend container to pick up the change.
        </p>
        <CodeBlock lang=".env (on the auth server)" code={`ALLOWED_ORIGINS=https://auth.vyntrise.com,https://yourapp.vyntrise.com`} />
        <CodeBlock lang="bash" code={`# SSH to auth.vyntrise.com server, then:
cd ~/vyntrise-auth
nano .env  # update ALLOWED_ORIGINS
docker compose up -d --force-recreate backend`} />

        <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          Use <IC>--force-recreate</IC> not just <IC>restart</IC> — environment variables are only
          picked up when the container is recreated.
        </div>
      </div>

      {/* Session revocation */}
      <div>
        <SectionHeader icon={Shield} title="Session Revocation Handling" color="bg-red-500/10 border border-red-500/20 text-red-400" />
        <p className="text-sm text-zinc-400 mb-2">
          When an admin revokes a session, the next API call returns <IC>401</IC> with a "revoked" message.
          Detect this and redirect to login.
        </p>
        <CodeBlock lang="typescript" code={`// In your authFetch or global error handler
if (res.status === 401) {
  const data = await res.json().catch(() => ({}));
  if (data.message?.toLowerCase().includes('revoked')) {
    localStorage.removeItem('accessToken');
    window.location.href = '/login?reason=session_revoked';
    return;
  }
  // Otherwise try to refresh
  const refreshed = await refreshToken();
  if (!refreshed) window.location.href = '/login';
}`} />
      </div>

      {/* Endpoint reference */}
      <div>
        <SectionHeader icon={BookOpen} title="Endpoint Reference" color="bg-zinc-800 border border-zinc-700 text-zinc-400" />
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium w-16">Method</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">URL</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Purpose</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {[
                { method: 'GET', path: `/login?platformId=${platform.id}&redirectUrl=...`, desc: 'SSO login entry point' },
                ...(platform.allowSelfRegistration
                  ? [{ method: 'GET', path: `/register?platformId=${platform.id}`, desc: 'SSO self-registration entry point' }]
                  : []),
                { method: 'GET', path: '/api/account/me', desc: 'Get user profile + platform roles' },
                { method: 'POST', path: '/api/auth/refresh', desc: 'Refresh access token via cookie' },
                { method: 'POST', path: '/api/auth/logout', desc: 'Logout and clear session' },
                ...(platform.allowSelfRegistration
                  ? [{ method: 'POST', path: '/api/auth/resend-verification', desc: 'Re-issue an email confirmation link' }]
                  : []),
                { method: 'GET', path: '/.well-known/jwks.json', desc: 'Public keys for verifying token signatures' },
                { method: 'GET', path: '/.well-known/openid-configuration', desc: 'Issuer metadata and supported algorithms' },
              ].map(({ method, path, desc }) => (
                <tr key={path} className="hover:bg-zinc-900/30">
                  <td className="px-4 py-3">
                    <Badge className={`text-xs font-mono ${method === 'GET' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {method}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-zinc-300 break-all">{AUTH_BASE}{path}</code>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{desc}</td>
                  <td className="px-4 py-3 text-right">
                    <CopyButton text={`${AUTH_BASE}${path}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-600">
          Need more detail?{' '}
          <a href="/admin/docs" className="text-indigo-400 hover:text-indigo-300 underline">
            View the full integration docs →
          </a>
        </p>
      </div>
    </div>
  );
}
