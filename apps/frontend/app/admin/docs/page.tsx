'use client';

import { useState } from 'react';
import { BookOpen, ChevronRight, Terminal, Globe, Key, RefreshCw, Shield, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/copy-button';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/80 my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-xs text-zinc-500 font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-zinc-300 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <Icon className="h-4 w-4 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
      </div>
      <div className="pl-11 space-y-4 text-zinc-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-zinc-100 mb-2">{title}</h3>
        <div className="text-sm text-zinc-400 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-indigo-300">
      {children}
    </code>
  );
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'setup', label: '1. Create Platform', icon: Globe },
  { id: 'invite', label: '2. Onboard Users', icon: Users },
  { id: 'redirect', label: '3. Redirect Flow', icon: Zap },
  { id: 'callback', label: '4. Handle Callback', icon: ChevronRight },
  { id: 'token', label: '5. Use Token', icon: Key },
  { id: 'refresh', label: '6. Token Refresh', icon: RefreshCw },
  { id: 'security', label: 'Security Notes', icon: Shield },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex gap-8 min-h-screen">
      {/* Left nav */}
      <aside className="w-52 shrink-0 sticky top-0 self-start pt-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">On this page</p>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors w-full
                ${activeSection === id
                  ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-12 pb-20">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
            <Terminal className="h-3.5 w-3.5" />
            <span>Integration Guide</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-50 tracking-tight">SSO Integration</h1>
          <p className="text-zinc-400 mt-2 text-base">
            Learn how to connect any Vyntrise product to centralized authentication at{' '}
            <InlineCode>auth.vyntrise.com</InlineCode>
          </p>
        </div>

        {/* Overview */}
        <Section id="overview" icon={BookOpen} title="Overview">
          <p>
            <InlineCode>auth.vyntrise.com</InlineCode> is the single identity provider for all Vyntrise products.
            External apps never handle passwords — they redirect unauthenticated users to the auth service,
            which authenticates them and returns a signed JWT.
          </p>

          <Card className="bg-zinc-900/50 border-zinc-800 mt-4">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <div className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs">
                  User visits yourapp.vyntrise.com
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                <div className="px-3 py-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs">
                  auth.vyntrise.com/login
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                <div className="px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-300 font-mono text-xs">
                  yourapp.vyntrise.com/callback?token=...
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'No password handling', desc: 'Your app never touches credentials' },
              { label: 'Platform-scoped access', desc: 'Users only access their invited platforms' },
              { label: 'Short-lived tokens', desc: '15-min access tokens, refreshed automatically' },
            ].map(({ label, desc }) => (
              <div key={label} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <p className="text-xs font-semibold text-zinc-200 mb-1">{label}</p>
                <p className="text-xs text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Step 1 */}
        <Section id="setup" icon={Globe} title="Step 1 — Create a Platform">
          <div className="space-y-4">
            <Step number={1} title="Go to the admin panel">
              <p>Navigate to <InlineCode>https://auth.vyntrise.com/admin/platforms</InlineCode></p>
            </Step>
            <Step number={2} title="Create a new platform">
              <p>Click <strong className="text-zinc-200">Create Platform</strong> and enter a name (e.g. "Vyntrise SMS").</p>
            </Step>
            <Step number={3} title="Copy the Platform ID">
              <p>After creation, copy the <strong className="text-zinc-200">Platform ID</strong> (UUID) from the table — you'll need it in Step 3.</p>
              <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <p className="text-xs text-amber-400">
                  Keep this ID safe. It ties SSO redirects and user invitations to the correct platform.
                </p>
              </div>
            </Step>
          </div>
        </Section>

        {/* Step 2 */}
        <Section id="invite" icon={Users} title="Step 2 — Onboard Users">
          <p>
            There are two ways users get access to a platform: an admin-issued invitation
            (default, works for every platform), or self-registration (opt-in per platform).
            Either way, the auth service is the only thing that ever handles a password —
            your app just links or redirects to <InlineCode>auth.vyntrise.com</InlineCode>.
          </p>

          <h3 className="font-medium text-zinc-100 mt-6 mb-2">Option A — Admin invites (default)</h3>
          <div className="space-y-4 mt-2">
            <Step number={1} title="Open Invitations">
              <p>Go to <InlineCode>https://auth.vyntrise.com/admin/invites</InlineCode></p>
            </Step>
            <Step number={2} title="Fill in the form">
              <ul className="list-disc list-inside space-y-1">
                <li>Enter the user's email address</li>
                <li>Select the target platform (e.g., "Vyntrise SMS")</li>
                <li>Choose a role: <InlineCode>USER</InlineCode> or <InlineCode>ADMIN</InlineCode></li>
              </ul>
            </Step>
            <Step number={3} title="Send the invite">
              <p>
                Click <strong className="text-zinc-200">Generate Link</strong>. The invite link is shown on screen
                and emailed to the user. It expires in <strong className="text-zinc-200">7 days</strong>.
              </p>
            </Step>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm">
            <p className="text-zinc-400">
              A user can be invited to <strong className="text-zinc-200">multiple platforms</strong> with different roles.
              Each invitation is independent.
            </p>
          </div>

          <h3 className="font-medium text-zinc-100 mt-6 mb-2">Option B — Self-registration (opt-in)</h3>
          <div className="space-y-4 mt-2">
            <Step number={1} title="Enable it on your platform">
              <p>
                Open your platform's page under <InlineCode>https://auth.vyntrise.com/admin/platforms</InlineCode>{' '}
                and turn on <strong className="text-zinc-200">Self-Registration</strong>. It's off by default —
                every platform starts invite-only.
              </p>
            </Step>
            <Step number={2} title="Share the sign-up link">
              <p>Link to (or redirect unauthenticated users who want an account to) this URL — it's shown on the platform page once enabled:</p>
              <CodeBlock language="url" code={`https://auth.vyntrise.com/register?platformId={PLATFORM_ID}`} />
            </Step>
            <Step number={3} title="User completes sign-up, then logs in">
              <p>
                The user enters an email and password on the hosted page, which calls{' '}
                <InlineCode>POST /api/auth/register</InlineCode> and creates a <InlineCode>USER</InlineCode>-role
                account on that platform. They're then redirected to <InlineCode>/login</InlineCode> — from there,
                the normal Step 3 redirect flow applies.
              </p>
            </Step>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs text-amber-400">
              Don't build your own sign-up form and call <InlineCode>/api/auth/register</InlineCode> directly from
              your app's frontend — that would mean handling passwords yourself and needing CORS opened for a
              credentials-bearing endpoint. Redirect to the hosted page instead, the same way Step 3 redirects
              to <InlineCode>/login</InlineCode> rather than calling <InlineCode>/api/auth/login</InlineCode> from
              your own UI.
            </p>
          </div>
        </Section>

        {/* Step 3 */}
        <Section id="redirect" icon={Zap} title="Step 3 — Redirect Unauthenticated Users">
          <p>
            When a user visits your app without a valid session, redirect them to:
          </p>
          <CodeBlock language="url" code={`https://auth.vyntrise.com/login?platformId={PLATFORM_ID}&redirectUrl={CALLBACK_URL}`} />

          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Parameter</th>
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                <tr>
                  <td className="px-4 py-2.5"><InlineCode>platformId</InlineCode></td>
                  <td className="px-4 py-2.5 text-zinc-400">UUID from the Platforms page</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5"><InlineCode>redirectUrl</InlineCode></td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    Full callback URL in your app — must be <InlineCode>https://*.vyntrise.com</InlineCode>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm mt-2">Example:</p>
          <CodeBlock language="url" code={`https://auth.vyntrise.com/login
  ?platformId=e4ddbaa4-ac57-4485-b634-667498e8d408
  &redirectUrl=https://sms.vyntrise.com/auth/callback`} />

          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs text-amber-400">
              <InlineCode>redirectUrl</InlineCode> must be an <InlineCode>https://*.vyntrise.com</InlineCode>{' '}
              subdomain — the login page checks this before it will attach a token and redirect
              there, both to prevent leaking tokens to arbitrary hosts and because the refresh-token
              cookie (see Step 6) only reaches same-site subdomains anyway.
            </p>
          </div>

          <p className="text-sm text-zinc-400">
            The auth system verifies the user has access to that platform before issuing a token.
            Users without access are rejected at login.
          </p>
        </Section>

        {/* Step 4 */}
        <Section id="callback" icon={ChevronRight} title="Step 4 — Handle the Callback">
          <p>
            After login, the user is redirected to your <InlineCode>redirectUrl</InlineCode> with the token appended:
          </p>
          <CodeBlock language="url" code={`https://sms.vyntrise.com/auth/callback?token=eyJhbGci...`} />

          <p className="text-sm">Extract and store the token:</p>
          <CodeBlock language="typescript" code={`// app/auth/callback/page.tsx (Next.js)
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

  return <div>Authenticating...</div>;
}`} />
        </Section>

        {/* Step 5 */}
        <Section id="token" icon={Key} title="Step 5 — Use the Token">
          <p>
            Include the access token as a <InlineCode>Bearer</InlineCode> token in all API requests
            back to <InlineCode>auth.vyntrise.com</InlineCode>:
          </p>
          <CodeBlock language="http" code={`GET https://auth.vyntrise.com/api/account/me
Authorization: Bearer eyJhbGci...`} />

          <p className="text-sm">Response:</p>
          <CodeBlock language="json" code={`{
  "id": "34d9497c-cbcf-489b-8b8c-7f7400e85005",
  "email": "user@example.com",
  "createdAt": "2026-06-15T12:00:00.000Z",
  "platforms": [
    {
      "platformId": "e4ddbaa4-ac57-4485-b634-667498e8d408",
      "platformName": "Vyntrise SMS",
      "role": "USER",
      "joinedAt": "2026-06-15T12:00:00.000Z"
    }
  ]
}`} />

          <p className="text-sm">Helper function for your app:</p>
          <CodeBlock language="typescript" code={`// lib/api.ts
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

  // Auto-handle token expiry
  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    return authFetch(path, options); // retry once
  }

  return res;
}`} />
        </Section>

        {/* Step 6 */}
        <Section id="refresh" icon={RefreshCw} title="Step 6 — Token Refresh">
          <p>
            Access tokens expire in <strong className="text-zinc-200">15 minutes</strong>. Use the
            refresh endpoint to get a new token silently:
          </p>
          <CodeBlock language="http" code={`POST https://auth.vyntrise.com/api/auth/refresh
(no body required — refresh token is sent via HTTP-only cookie)`} />

          <CodeBlock language="typescript" code={`// Refresh token helper
async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch('https://auth.vyntrise.com/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // sends the refreshToken cookie automatically
    });

    if (!res.ok) return false;

    const { accessToken } = await res.json();
    localStorage.setItem('accessToken', accessToken);
    return true;
  } catch {
    return false;
  }
}`} />

          <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm space-y-2">
            <p className="font-medium text-zinc-200">Requirements for cross-origin token refresh:</p>
            <ul className="list-disc list-inside text-zinc-400 space-y-1">
              <li>Your app must be on a <InlineCode>*.vyntrise.com</InlineCode> subdomain</li>
              <li>Requests must use <InlineCode>credentials: 'include'</InlineCode></li>
              <li>Your origin must be in the auth server's <InlineCode>ALLOWED_ORIGINS</InlineCode></li>
            </ul>
          </div>
        </Section>

        {/* Security */}
        <Section id="security" icon={Shield} title="Security Notes">
          <div className="space-y-3">
            {[
              {
                title: 'Never expose the refresh token',
                desc: 'It\'s stored in an HTTP-only cookie and is never accessible via JavaScript.',
              },
              {
                title: 'Validate platform access at login',
                desc: 'The platformId check at login ensures users can only access platforms they\'ve been invited to.',
              },
              {
                title: 'Short-lived access tokens',
                desc: '15-minute expiry limits exposure if a token is leaked. Always refresh proactively.',
              },
              {
                title: 'Session revocation is immediate',
                desc: 'When a session is revoked from the Account page, the next authenticated request returns 401. Handle this by redirecting to login.',
              },
            ].map(({ title, desc }) => (
              <div key={title} className="flex gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <Shield className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm mt-4">Handle session revocation in your app:</p>
          <CodeBlock language="typescript" code={`// Detect revoked session in API response
if (res.status === 401) {
  const data = await res.json();
  if (data.message?.toLowerCase().includes('revoked')) {
    localStorage.removeItem('accessToken');
    window.location.href = '/login?reason=session_revoked';
    return;
  }
  // Otherwise try to refresh
  const refreshed = await refreshToken();
  if (!refreshed) window.location.href = '/login';
}`} />
        </Section>

        {/* Quick Reference */}
        <section id="reference">
          <h2 className="text-xl font-semibold text-zinc-50 mb-4">Quick Reference</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Endpoint</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[
                  ['/login?platformId=X&redirectUrl=Y', 'SSO login entry point'],
                  ['/register?platformId=X', 'SSO self-registration entry point (if enabled)'],
                  ['/api/auth/refresh', 'Refresh access token (POST)'],
                  ['/api/auth/logout', 'Logout and clear session (POST)'],
                  ['/api/account/me', 'Get user profile + platform memberships (GET)'],
                  ['/admin/platforms', 'Manage platforms and copy Platform IDs'],
                ].map(([endpoint, purpose]) => (
                  <tr key={endpoint}>
                    <td className="px-4 py-3">
                      <code className="text-xs text-indigo-300 font-mono">auth.vyntrise.com{endpoint}</code>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
