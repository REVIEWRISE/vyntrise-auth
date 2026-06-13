'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function AdminInvites() {
  const [invites, setInvites] = useState<Array<{ id: string, email: string, role: string, used: boolean, expiresAt: string }>>([]);
  const [error, setError] = useState('');
  
  // Form State
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('USER');
  const [creating, setCreating] = useState(false);

  const fetchInvites = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3010/api/admin/invites', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch invites');
      
      const data = await res.json();
      setInvites(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInvites();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3010/api/admin/invites', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, role })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create invite');
      }

      setEmail('');
      setRole('USER');
      fetchInvites();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Invitations</h1>
        <p className="text-zinc-400 mt-1">Manage platform invitations and generate new ones.</p>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* Invites Table */}
        <Card className="bg-zinc-950/50 border-zinc-800 order-2 md:order-1">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Role</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-right text-zinc-400">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map(invite => (
                <TableRow key={invite.id} className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell className="font-medium text-zinc-100">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-zinc-300 border-zinc-700">
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invite.used ? (
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 hover:bg-zinc-800">
                        Used
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-zinc-400">
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                    No invitations found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Create Invite Form */}
        <Card className="bg-zinc-950/50 border-zinc-800 h-fit order-1 md:order-2">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50">Create Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">Email Address</Label>
                <Input 
                  id="email"
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role" className="text-zinc-300">Role</Label>
                <select 
                  id="role"
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-offset-background placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <Button 
                type="submit" 
                disabled={creating}
                className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
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
