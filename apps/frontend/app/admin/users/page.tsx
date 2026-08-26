'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useAdminPlatform } from '../admin-platform-context';

interface Member {
  id: string;
  email: string;
  role: string;
  accessCreatedAt: string;
}

export default function AdminUsers() {
  const { platformId } = useAdminPlatform();
  const [users, setUsers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/admin/users?platformId=${platformId}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      setUsers(await res.json());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [platformId]);

  useEffect(() => {
    if (platformId) fetchUsers();
  }, [platformId, fetchUsers]);

  const changeRole = async (user: Member, role: string) => {
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}?platformId=${platformId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update role');
      setNotice(`${user.email} is now ${role}`);
      fetchUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (user: Member) => {
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}?platformId=${platformId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove user');
      setNotice(`${user.email} no longer has access to this platform`);
      setConfirmRemove(null);
      fetchUsers();
    } catch (err) {
      setError((err as Error).message);
      setConfirmRemove(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Users</h1>
        <p className="text-zinc-400 mt-1">Manage users who have access to this platform.</p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          {notice}
        </div>
      )}

      <Card className="bg-zinc-950/50 border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Email</TableHead>
              <TableHead className="text-zinc-400">Role</TableHead>
              <TableHead className="text-zinc-400">Joined</TableHead>
              <TableHead className="text-right text-zinc-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="font-medium text-zinc-100">{user.email}</TableCell>
                <TableCell>
                  <Badge
                    className={user.role === 'ADMIN'
                      ? 'bg-indigo-500/20 text-indigo-300 border-0'
                      : 'bg-blue-500/10 text-blue-300 border-0'}
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {new Date(user.accessCreatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {confirmRemove?.id === user.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-zinc-400">Remove from platform?</span>
                      <Button
                        size="sm"
                        onClick={() => removeUser(user)}
                        disabled={busyId === user.id}
                        className="h-7 bg-red-500/90 text-white hover:bg-red-500"
                      >
                        {busyId === user.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : 'Remove'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmRemove(null)}
                        className="h-7 text-zinc-400 hover:text-zinc-100"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={user.role}
                        disabled={busyId === user.id}
                        onChange={(e) => changeRole(user, e.target.value)}
                        className="h-7 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmRemove(user)}
                        disabled={busyId === user.id}
                        className="h-7 text-zinc-500 hover:text-red-400"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-zinc-500">
        Removing someone revokes their access to this platform only — their account and any
        other platforms they belong to are untouched. A platform must keep at least one admin.
      </p>
    </div>
  );
}
