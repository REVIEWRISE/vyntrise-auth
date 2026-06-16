'use client';

import { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy, Check } from 'lucide-react';

interface Invite {
  id: string;
  email: string;
  isUsed: boolean;
  expiresAt: string;
  token: string;
  platformId: string;
  role: string;
  platform: {
    name: string;
  };
}

interface Platform {
  id: string;
  name: string;
  description: string | null;
}

import { apiFetch } from '@/lib/api';

export default function AdminInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('USER');
  const [platformId, setPlatformId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchInvites = async () => {
    try {
      const res = await apiFetch('/api/admin/invites');
      if (!res.ok) throw new Error('Failed to fetch invites');
      const data = await res.json();
      setInvites(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fetchPlatforms = async () => {
    try {
      const res = await apiFetch('/api/admin/platforms');
      if (!res.ok) throw new Error('Failed to fetch platforms');
      const data = await res.json();
      setPlatforms(data);
      // Set the first platform as default
      if (data.length > 0 && !platformId) {
        setPlatformId(data[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => { 
    fetchInvites(); 
    fetchPlatforms();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNewLink('');

    if (!platformId) {
      setError('Please select a platform');
      setCreating(false);
      return;
    }

    try {
      const res = await apiFetch('/api/admin/invites', {
        method: 'POST',
        body: JSON.stringify({ email, role, platformId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create invite');

      setNewLink(data.registerLink);
      setEmail('');
      setRole('USER');
      fetchInvites();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(newLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Invitations</h1>
        <p className="text-zinc-400 mt-1">Manage platform invitations and generate new ones.</p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {newLink && (
        <div className="p-4 rounded-md bg-green-500/10 border border-green-500/20 space-y-2">
          <p className="text-green-400 text-sm font-medium">Invitation created! Share this link:</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={newLink}
              className="bg-zinc-950/50 border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="shrink-0 text-zinc-400 hover:text-zinc-100"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* Invites table */}
        <Card className="bg-zinc-950/50 border-zinc-800 order-2 md:order-1">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Platform</TableHead>
                <TableHead className="text-zinc-400">Role</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-right text-zinc-400">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id} className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell className="font-medium text-zinc-100">{invite.email}</TableCell>
                  <TableCell className="text-zinc-300">{invite.platform.name}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={invite.role === 'ADMIN' 
                        ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' 
                        : 'border-zinc-700 text-zinc-400 bg-zinc-800/50'
                      }
                    >
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invite.isUsed ? (
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">Used</Badge>
                    ) : new Date(invite.expiresAt) < new Date() ? (
                      <Badge className="bg-red-500/20 text-red-400 border-0">Expired</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-zinc-400">
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                    No invitations found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Create invite form */}
        <Card className="bg-zinc-950/50 border-zinc-800 h-fit order-1 md:order-2">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50">Create Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inv-email" className="text-zinc-300">Email Address</Label>
                <Input
                  id="inv-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-platform" className="text-zinc-300">Platform</Label>
                <select
                  id="inv-platform"
                  value={platformId}
                  onChange={(e) => setPlatformId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="">Select a platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-role" className="text-zinc-300">Role</Label>
                <select
                  id="inv-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <Button
                type="submit"
                disabled={creating}
                className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
              >
                {creating ? 'Generating...' : 'Generate Link'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
