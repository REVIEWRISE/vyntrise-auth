'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, ArrowLeft, Shield, LogOut } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Platform {
  platformId: string;
  platformName: string;
  role: string;
  joinedAt: string;
}

interface Profile {
  id: string;
  email: string;
  createdAt: string;
  platforms: Platform[];
}

interface Session {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  userAgent: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-3 rounded-md">
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-md">
      {message}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();

  // ── Global state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Section: Change Email ─────────────────────────────────────────────────
  const [emailNewEmail, setEmailNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // ── Section: Change Password ──────────────────────────────────────────────
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // ── Section: Danger Zone ──────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Auth guard + initial fetch ────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    Promise.all([
      apiFetch('/api/account/me'),
      apiFetch('/api/account/sessions'),
    ])
      .then(async ([meRes, sessionsRes]) => {
        if (meRes.ok) {
          const data = await meRes.json();
          setProfile(data);
          // Check if user is admin on any platform
          setIsAdmin(data.platforms?.some((p: Platform) => p.role === 'ADMIN') || false);
        }
        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          setSessions(data);
        }
      })
      .catch(() => {
        // Non-fatal — page can still render partially
      })
      .finally(() => setLoadingProfile(false));
  }, [router]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError('');
    setEmailSuccess('');

    try {
      const res = await apiFetch('/api/account/email', {
        method: 'PATCH',
        body: JSON.stringify({ newEmail: emailNewEmail, currentPassword: emailCurrentPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, email: emailNewEmail } : prev);
        setEmailSuccess('Email updated successfully');
        setEmailNewEmail('');
        setEmailCurrentPassword('');
      } else {
        setEmailError(data.message || 'Failed to update email');
      }
    } catch {
      setEmailError('An unexpected error occurred');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (pwdNew !== pwdConfirm) {
      setPwdError('Passwords do not match');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await apiFetch('/api/account/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdSuccess('Password updated successfully');
        setPwdCurrent('');
        setPwdNew('');
        setPwdConfirm('');
      } else {
        setPwdError(data.message || 'Failed to update password');
      }
    } catch {
      setPwdError('An unexpected error occurred');
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      const res = await apiFetch(`/api/account/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        
        // Check if we just revoked our own session by trying to make another request
        const checkRes = await apiFetch('/api/account/me');
        if (!checkRes.ok) {
          // We revoked our own session - redirect to login
          localStorage.removeItem('accessToken');
          router.push('/login?message=session-revoked');
        }
      }
    } catch {
      // If the request fails due to revoked session, redirect to login
      localStorage.removeItem('accessToken');
      router.push('/login?message=session-revoked');
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await apiFetch('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem('accessToken');
        router.push('/login');
      } else {
        setDeleteError(data.message || 'Failed to delete account');
      }
    } catch {
      setDeleteError('An unexpected error occurred');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center dark">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 dark">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin')}
              className="text-zinc-400 hover:text-zinc-100 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          )}
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('accessToken');
                router.push('/login');
              }}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Account Settings</h1>
          {profile && (
            <p className="text-zinc-400 mt-1">
              {profile.email} · Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* ── Section 1: Change Email ── */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-50 text-lg font-semibold">Change Email</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangeEmail} className="space-y-4">
              {emailSuccess && <SuccessBanner message={emailSuccess} />}
              {emailError && <ErrorBanner message={emailError} />}
              <div className="space-y-2">
                <Label htmlFor="newEmail" className="text-zinc-200">New Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={emailNewEmail}
                  onChange={(e) => setEmailNewEmail(e.target.value)}
                  required
                  placeholder="new@example.com"
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailCurrentPassword" className="text-zinc-200">Current Password</Label>
                <Input
                  id="emailCurrentPassword"
                  type="password"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <Button
                type="submit"
                disabled={emailLoading}
                className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
              >
                {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Email
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Section 2: Change Password ── */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-50 text-lg font-semibold">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {pwdSuccess && <SuccessBanner message={pwdSuccess} />}
              {pwdError && <ErrorBanner message={pwdError} />}
              <div className="space-y-2">
                <Label htmlFor="pwdCurrent" className="text-zinc-200">Current Password</Label>
                <Input
                  id="pwdCurrent"
                  type="password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwdNew" className="text-zinc-200">New Password</Label>
                <Input
                  id="pwdNew"
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwdConfirm" className="text-zinc-200">Confirm New Password</Label>
                <Input
                  id="pwdConfirm"
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <Button
                type="submit"
                disabled={pwdLoading}
                className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
              >
                {pwdLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Section 3: Platform Memberships ── */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-50 text-lg font-semibold">Platform Memberships</CardTitle>
          </CardHeader>
          <CardContent>
            {profile?.platforms && profile.platforms.length > 0 ? (
              <ul className="space-y-3">
                {profile.platforms.map((p) => (
                  <li key={p.platformId} className="flex items-center justify-between">
                    <span className="text-zinc-100 text-sm">{p.platformName}</span>
                    <Badge
                      className={
                        p.role === 'ADMIN'
                          ? 'bg-indigo-500/20 text-indigo-300 border-0'
                          : 'bg-blue-500/10 text-blue-300 border-0'
                      }
                    >
                      {p.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-sm">You are not a member of any platforms.</p>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Active Sessions ── */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-50 text-lg font-semibold">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length > 0 ? (
              <ul className="space-y-3">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-zinc-100 text-sm truncate">
                        {session.userAgent || 'Unknown device'}
                      </p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Started {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      className="shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-sm">No active sessions found.</p>
            )}
          </CardContent>
        </Card>

        {/* ── Section 5: Danger Zone ── */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-red-400 text-lg font-semibold">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showDeleteConfirm ? (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            ) : (
              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <p className="text-zinc-400 text-sm">
                  This action is permanent and cannot be undone. Enter your password to confirm.
                </p>
                {deleteError && <ErrorBanner message={deleteError} />}
                <div className="space-y-2">
                  <Label htmlFor="deletePassword" className="text-zinc-200">Password</Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={deleteLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                      setDeleteError('');
                    }}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
