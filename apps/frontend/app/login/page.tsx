'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Tracked separately from `error` because this one is recoverable — the user needs a link
  // to the confirmation flow, not just a red box telling them they cannot get in.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const successMessage = searchParams.get('message') === 'password-reset'
    ? 'Your password has been reset. Please sign in.'
    : null;

  const infoMessage = searchParams.get('message') === 'session-revoked'
    ? 'Your session has been revoked. Please sign in again.'
    : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNeedsVerification(false);

    const platformId = searchParams.get('platformId');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(platformId ? { platformId } : {}) }),
      });

      const data = await response.json();

      if (response.ok) {
        if (!data.accessToken) {
          setError('Login succeeded but no access token was returned');
          return;
        }
        localStorage.setItem('accessToken', data.accessToken);

        const redirectUrl = searchParams.get('redirectUrl');
        if (redirectUrl) {
          try {
            const url = new URL(redirectUrl);
            // Never even ask about a non-http(s) URL: a javascript: URI here would be XSS.
            if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad scheme');

            // Which hosts may receive a token is decided by the auth server: each platform
            // registers its redirect URIs (Platforms → Security), with the old *.vyntrise.com /
            // localhost rule as a fallback for platforms that have none yet. Anything it does
            // not explicitly allow is an open redirect / token-exfiltration vector.
            const check = await fetch(
              `/api/auth/redirect-check?${new URLSearchParams({ platformId: platformId ?? '', redirectUrl })}`
            );
            const { allowed } = check.ok ? await check.json() : { allowed: false };
            if (allowed) {
              url.searchParams.append('token', data.accessToken);
              window.location.href = url.toString();
            } else {
              router.replace('/admin');
            }
          } catch {
            // Invalid URL or the check failed — fall through to default
            router.replace('/admin');
          }
        } else {
          router.replace('/admin');
        }
      } else {
        setError(data.message || 'Login failed');
        setNeedsVerification(data.code === 'EMAIL_NOT_VERIFIED');
      }
    } catch {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {successMessage && (
        <div className="mb-6 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
          {successMessage}
        </div>
      )}
      {infoMessage && (
        <div className="mb-6 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium">
          {infoMessage}
        </div>
      )}
      {error && (
        <div className="mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          {error}
          {needsVerification && (
            <Link
              href="/verify-email"
              className="block mt-2 font-normal text-red-300 underline hover:text-red-200"
            >
              Resend the confirmation link
            </Link>
          )}
        </div>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-200">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="you@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-200">Password</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" className="w-full mt-6 bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 dark">
      <Card className="w-full max-w-md shadow-lg border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <CardHeader className="space-y-1 text-center pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight text-zinc-50">
            Sign in to Vyntrise
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enter your email and password to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

