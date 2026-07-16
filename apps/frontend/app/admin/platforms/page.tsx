'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Copy, Check, ChevronDown, ChevronUp, BookOpen, Zap, Key, RefreshCw, Shield } from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface Platform {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  userCount: number;
}

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors ${className}`}
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeSnippet({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900">
          <span className="text-xs text-zinc-500 font-mono">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!label && (
        <div className="flex justify-end px-3 pt-2">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="px-3 py-2.5 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function IntegrationGuide({ platform }: { platform: Platform }) {
  const [open, setOpen] = useState(false);
  const AUTH_BASE = 'https://auth.vyntrise.com';
  const loginUrl = `${AUTH_BASE}/login?platformId=${platform.id}&redirectUrl=https://your-app.com/auth/callback`;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-medium text-zinc-200">Integration Guide</span>
          <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-xs font-mono">
            {platform.id.substring(0, 8)}...
          </Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="px-4 pb-5 pt-4 space-y-5 bg-zinc-950/30 border-t border-zinc-800">

          {/* Platform ID */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Platform ID</p>
            <CodeSnippet code={platform.id} />
            <p className="text-xs text-zinc-500 mt-1.5">Use this ID everywhere below.</p>
          </div>

          {/* Step 1 — redirect */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <p className="text-xs font-semibold text-zinc-300">Step 1 — Redirect unauthenticated users</p>
            </div>
            <CodeSnippet label="redirect url" code={loginUrl} />
            <p className="text-xs text-zinc-500 mt-1.5">
              Replace <span className="text-zinc-300 font-mono">https://your-app.com/auth/callback</span> with your app's actual callback URL.
            </p>
          </div>

          {/* Step 2 — callback */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-3.5 w-3.5 text-green-400" />
              <p className="text-xs font-semibold text-zinc-300">Step 2 — Handle the callback</p>
            </div>
            <CodeSnippet label="typescript" code={`// app/auth/callback/page.tsx
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

  return <p>Authenticating...</p>;
}`} />
          </div>

          {/* Step 3 — API calls */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-xs font-semibold text-zinc-300">Step 3 — Make authenticated API calls</p>
            </div>
            <CodeSnippet label="typescript" code={`// Fetch user profile
const res = await fetch('${AUTH_BASE}/api/account/me', {
  credentials: 'include',
  headers: {
    Authorization: \`Bearer \${localStorage.getItem('accessToken')}\`,
  },
});
const user = await res.json();
// { id, email, platforms: [{ platformId, platformName, role }] }`} />

            <p className="text-xs text-zinc-500 mt-2 mb-2">Refresh the access token (expires in 15 min):</p>
            <CodeSnippet label="typescript" code={`// POST to refresh — cookie is sent automatically
const res = await fetch('${AUTH_BASE}/api/auth/refresh', {
  method: 'POST',
  credentials: 'include',
});
const { accessToken } = await res.json();
localStorage.setItem('accessToken', accessToken);`} />
          </div>

          {/* Step 4 — CORS */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-3.5 w-3.5 text-orange-400" />
              <p className="text-xs font-semibold text-zinc-300">Step 4 — Allow your origin in CORS</p>
            </div>
            <p className="text-xs text-zinc-400 mb-2">
              Add your app's domain to <span className="text-zinc-200 font-mono">ALLOWED_ORIGINS</span> in the auth server's{' '}
              <span className="text-zinc-200 font-mono">.env</span> file, then recreate the backend container:
            </p>
            <CodeSnippet label=".env" code={`ALLOWED_ORIGINS=https://auth.vyntrise.com,https://your-app.com`} />
            <CodeSnippet label="bash" code={`docker compose up -d --force-recreate backend`} />
          </div>

          {/* Endpoints reference */}
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Endpoint Reference</p>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {[
                { method: 'GET', path: `/login?platformId=${platform.id}&redirectUrl=...`, desc: 'SSO login entry point' },
                { method: 'GET', path: '/api/account/me', desc: 'Get user profile + platforms' },
                { method: 'POST', path: '/api/auth/refresh', desc: 'Refresh access token' },
                { method: 'POST', path: '/api/auth/logout', desc: 'Logout and clear session' },
              ].map(({ method, path, desc }) => (
                <div key={path} className="flex items-start gap-3 px-3 py-2">
                  <span className={`text-xs font-mono font-bold shrink-0 ${method === 'GET' ? 'text-green-400' : 'text-blue-400'}`}>
                    {method}
                  </span>
                  <div className="min-w-0 flex-1">
                    <code className="text-xs text-zinc-300 font-mono break-all">{AUTH_BASE}{path}</code>
                    <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>
                  </div>
                  <CopyButton text={`${AUTH_BASE}${path}`} className="shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-600">
            For detailed implementation, see{' '}
            <a href="/admin/docs" className="text-indigo-400 hover:text-indigo-300 underline">
              the full integration docs →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminPlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchPlatforms = async () => {
    try {
      const res = await apiFetch('/api/admin/platforms');
      if (!res.ok) throw new Error('Failed to fetch platforms');
      setPlatforms(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlatforms(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const res = await apiFetch('/api/admin/platforms', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create platform');

      setCreateSuccess(`Platform "${data.name}" created successfully`);
      setName('');
      setDescription('');
      fetchPlatforms();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Platforms</h1>
        <p className="text-zinc-400 mt-1">Manage platforms and integrate them with Vyntrise Auth.</p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Left column — table + per-platform integration guides */}
        <div className="space-y-3 order-2 md:order-1">
          <Card className="bg-zinc-950/50 border-zinc-800">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Name</TableHead>
                    <TableHead className="text-zinc-400">Platform ID</TableHead>
                    <TableHead className="text-zinc-400">Description</TableHead>
                    <TableHead className="text-zinc-400">Members</TableHead>
                    <TableHead className="text-right text-zinc-400">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platforms.map((p) => (
                    <TableRow key={p.id} className="border-zinc-800 hover:bg-zinc-900/50">
                      <TableCell className="font-medium text-zinc-100">{p.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                            {p.id.substring(0, 8)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
                            onClick={() => copyId(p.id)}
                            title="Copy full Platform ID"
                          >
                            {copiedId === p.id
                              ? <Check className="h-3 w-3 text-green-400" />
                              : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">{p.description || '—'}</TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500/10 text-blue-300 border-0">{p.userCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-zinc-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {platforms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                        No platforms yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Per-platform integration guides */}
          {platforms.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
                Integration Guide — click a platform to expand
              </p>
              {platforms.map((p) => (
                <IntegrationGuide key={p.id} platform={p} />
              ))}
            </div>
          )}
        </div>

        {/* Right column — create form */}
        <div className="space-y-4 order-1 md:order-2">
          <Card className="bg-zinc-950/50 border-zinc-800 h-fit">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-50">Create Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                {createSuccess && (
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    {createSuccess}
                  </div>
                )}
                {createError && (
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {createError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="plat-name" className="text-zinc-300">Platform Name</Label>
                  <Input
                    id="plat-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vyntrise SMS"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plat-desc" className="text-zinc-300">
                    Description <span className="text-zinc-500">(optional)</span>
                  </Label>
                  <Input
                    id="plat-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
                >
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                  ) : 'Create Platform'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick tip card */}
          <Card className="bg-zinc-950/50 border-zinc-800">
            <CardContent className="pt-4 pb-4 space-y-2 text-xs text-zinc-500">
              <p className="font-medium text-zinc-400">Quick setup</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Create a platform above</li>
                <li>Copy its ID from the table</li>
                <li>Expand its integration guide</li>
                <li>Follow the 4-step code walkthrough</li>
              </ol>
              <a
                href="/admin/docs"
                className="block pt-1 text-indigo-400 hover:text-indigo-300 underline"
              >
                Full integration docs →
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


