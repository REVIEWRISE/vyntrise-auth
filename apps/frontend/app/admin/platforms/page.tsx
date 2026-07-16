'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Copy, Check, ChevronRight } from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface Platform {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  userCount: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function AdminPlatforms() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchPlatforms = async () => {
    try {
      const res = await apiFetch('/api/admin/platforms');
      if (!res.ok) throw new Error('Failed to fetch platforms');
      setPlatforms(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlatforms(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const res = await apiFetch('/api/admin/platforms', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create platform');

      setCreateSuccess(`Platform "${data.name}" created successfully`);
      setName('');
      setDescription('');
      fetchPlatforms();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Platforms</h1>
        <p className="text-zinc-400 mt-1">Manage platforms and integrate them with Vyntrise Auth.</p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Left column — table + per-platform integration guides */}
        <div className="space-y-3 order-2 md:order-1">
          <Card className="bg-zinc-950/50 border-zinc-800">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Name</TableHead>
                    <TableHead className="text-zinc-400">Platform ID</TableHead>
                    <TableHead className="text-zinc-400">Description</TableHead>
                    <TableHead className="text-zinc-400">Members</TableHead>
                    <TableHead className="text-right text-zinc-400">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platforms.map((p) => (
                    <TableRow
                      key={p.id}
                      className="border-zinc-800 hover:bg-zinc-900/50 cursor-pointer group"
                      onClick={() => router.push(`/admin/platforms/${p.id}`)}
                    >
                      <TableCell className="font-medium text-zinc-100 group-hover:text-white">
                        <div className="flex items-center gap-2">
                          {p.name}
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                            {p.id.substring(0, 8)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
                            onClick={(e) => { e.stopPropagation(); copyId(p.id); }}
                            title="Copy full Platform ID"
                          >
                            {copiedId === p.id
                              ? <Check className="h-3 w-3 text-green-400" />
                              : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">{p.description || '—'}</TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500/10 text-blue-300 border-0">{p.userCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-zinc-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {platforms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                        No platforms yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>

          {platforms.length > 0 && (
            <p className="text-xs text-zinc-500 px-1">
              Click any platform to view its integration guide.
            </p>
          )}
        </div>

        {/* Right column — create form */}
        <div className="space-y-4 order-1 md:order-2">
          <Card className="bg-zinc-950/50 border-zinc-800 h-fit">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-50">Create Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                {createSuccess && (
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    {createSuccess}
                  </div>
                )}
                {createError && (
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {createError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="plat-name" className="text-zinc-300">Platform Name</Label>
                  <Input
                    id="plat-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vyntrise SMS"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plat-desc" className="text-zinc-300">
                    Description <span className="text-zinc-500">(optional)</span>
                  </Label>
                  <Input
                    id="plat-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold"
                >
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                  ) : 'Create Platform'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick tip card */}
          <Card className="bg-zinc-950/50 border-zinc-800">
            <CardContent className="pt-4 pb-4 space-y-2 text-xs text-zinc-500">
              <p className="font-medium text-zinc-400">Quick setup</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Create a platform above</li>
                <li>Copy its ID from the table</li>
                <li>Expand its integration guide</li>
                <li>Follow the 4-step code walkthrough</li>
              </ol>
              <a
                href="/admin/docs"
                className="block pt-1 text-indigo-400 hover:text-indigo-300 underline"
              >
                Full integration docs →
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


