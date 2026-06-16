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
import { Card } from '@/components/ui/card';

import { apiFetch } from '@/lib/api';

export default function AdminUsers() {
  const [users, setUsers] = useState<Array<{ id: string, email: string, role: string, accessCreatedAt: string }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiFetch('/api/admin/users');
        
        if (!res.ok) throw new Error('Failed to fetch users');
        
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    fetchUsers();
  }, []);

  if (error) return (
    <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
      {error}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Users</h1>
        <p className="text-zinc-400 mt-1">Manage users who have access to this platform.</p>
      </div>

      <Card className="bg-zinc-950/50 border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-[100px] text-zinc-400">ID</TableHead>
              <TableHead className="text-zinc-400">Email</TableHead>
              <TableHead className="text-zinc-400">Role</TableHead>
              <TableHead className="text-right text-zinc-400">Joined At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="font-mono text-xs text-zinc-500">
                  {user.id.substring(0, 8)}...
                </TableCell>
                <TableCell className="font-medium text-zinc-100">{user.email}</TableCell>
                <TableCell>
                  <Badge 
                    variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                    className={user.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-0' : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border-0'}
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-zinc-400">
                  {new Date(user.accessCreatedAt).toLocaleDateString()}
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
    </div>
  );
}
