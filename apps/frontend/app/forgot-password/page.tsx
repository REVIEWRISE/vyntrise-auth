'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // intentionally ignored — always show the same message
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 dark">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <Card className="w-full shadow-lg border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-50">
              Forgot your password?
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your email and we&apos;ll send you a reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <p className="text-center text-zinc-300 text-sm py-4">
                If that email is registered, a reset link has been sent.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button
                  type="submit"
                  className="w-full mt-6 bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>
            )}
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
