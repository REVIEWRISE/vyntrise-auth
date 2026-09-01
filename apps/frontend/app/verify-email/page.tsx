'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2 } from 'lucide-react';

type Status = 'verifying' | 'confirmed' | 'failed' | 'missing';

function ResendForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // The endpoint answers identically whether or not the address is registered, so there is
      // nothing to branch on here — showing the same confirmation is the point.
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p className="text-sm text-zinc-400 text-center">
        If that address needs confirming, a new link is on its way. It expires in 24 hours.
      </p>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="resend-email" className="text-zinc-200">Send a new link</Label>
        <Input
          id="resend-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>
      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
      >
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          'Resend confirmation link'
        )}
      </Button>
    </form>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'missing');
  const [message, setMessage] = useState('');

  // React runs effects twice in development. Without this guard the second pass would post the
  // same single-use token again and turn a successful confirmation into an error.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();

        setMessage(data.message ?? '');
        setStatus(response.ok ? 'confirmed' : 'failed');
      } catch {
        setMessage('We could not reach the server. Please try again.');
        setStatus('failed');
      }
    })();
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-400">Confirming your address...</p>
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <p className="text-sm text-zinc-300 text-center">
            {message || 'Email address confirmed. You can now sign in.'}
          </p>
        </div>
        <Button asChild className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
        {status === 'missing'
          ? 'This page needs a confirmation link. Open the link from your email, or request a new one below.'
          : message || 'This confirmation link is invalid or has expired.'}
      </div>
      <ResendForm />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 dark">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <Card className="w-full shadow-lg border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-50">
              Confirm your email
            </CardTitle>
            <CardDescription className="text-zinc-400">
              One step before your account is ready
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                </div>
              }
            >
              <VerifyEmailContent />
            </Suspense>
          </CardContent>
        </Card>
        <Link href="/login" className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
