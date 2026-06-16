'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function RegisterForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid or missing invitation token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/invite/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Account created successfully! Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {success && (
        <div className="mb-6 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          {error}
        </div>
      )}
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-200">Create Password</Label>
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
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-zinc-200">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
              Creating Account...
            </>
          ) : (
            'Complete Setup'
          )}
        </Button>
      </form>
    </>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 dark">
      <Card className="w-full max-w-md shadow-lg border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <CardHeader className="space-y-1 text-center pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight text-zinc-50">
            Join Vyntrise
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Complete your account setup to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          }>
            <RegisterForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
