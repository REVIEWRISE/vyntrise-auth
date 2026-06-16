'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [matchError, setMatchError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/reset-password/${token}`);
        const data = await response.json();
        setTokenValid(response.ok && data.valid === true);
      } catch {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError('');
    setSubmitError('');

    if (newPassword !== confirmNewPassword) {
      setMatchError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword }),
      });

      if (response.ok) {
        router.push('/login?message=password-reset');
      } else {
        const data = await response.json();
        setSubmitError(data.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          This reset link is invalid or has expired. Please request a new one.
        </div>
        <Link
          href="/forgot-password"
          className="block text-center text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <>
      {submitError && (
        <div className="mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          {submitError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-zinc-200">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword" className="text-zinc-200">Confirm New Password</Label>
          <Input
            id="confirmNewPassword"
            type="password"
            placeholder="••••••••"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
          {matchError && (
            <p className="text-red-400 text-sm">{matchError}</p>
          )}
        </div>
        <Button
          type="submit"
          className="w-full mt-6 bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset Password'
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 dark">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <Card className="w-full shadow-lg border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-50">
              Reset your password
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>}>
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
        <Link
          href="/login"
          className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
