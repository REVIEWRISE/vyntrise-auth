'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { subDays, subHours } from 'date-fns';
import { Check, Download, ListFilter, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_PLATFORMS, useAdminSession } from '../admin-session-context';
import { scopeParam, useAuditMeta, type AuditFilters } from '@/lib/admin-api';
import { apiFetch, qs } from '@/lib/api';
import { useDebounced } from '@/lib/use-debounced';
import { AuditTable } from '@/components/admin/audit-table';
import { activityMeta } from '@/components/admin/activity';
import { PageHeader } from '@/components/admin/primitives';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function periodStart(period: string): string | undefined {
  const now = new Date();
  switch (period) {
    case '24h': return subHours(now, 24).toISOString();
    case '7d': return subDays(now, 7).toISOString();
    case '30d': return subDays(now, 30).toISOString();
    case '90d': return subDays(now, 90).toISOString();
    default: return undefined;
  }
}

function ActionFilter({ value, onChange, actions }: { value: string[]; onChange: (v: string[]) => void; actions: string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 border-dashed', value.length && 'border-solid border-primary/40')}>
          <ListFilter /> Action
          {value.length > 0 && <span className="rounded bg-primary/15 px-1.5 text-xs text-primary">{value.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Filter actions…" />
          <CommandList>
            <CommandEmpty>No action found.</CommandEmpty>
            <CommandGroup>
              {actions.map((a) => {
                const on = value.includes(a);
                const meta = activityMeta(a);
                return (
                  <CommandItem key={a} value={`${a} ${meta.label}`} onSelect={() => onChange(on ? value.filter((v) => v !== a) : [...value, a])}>
                    <span className={cn('grid h-4 w-4 place-items-center rounded-[4px] border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                      {on && <Check className="!h-3 !w-3 !text-primary-foreground" />}
                    </span>
                    <meta.icon />
                    <span className="truncate">{meta.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>Clear actions</Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AuditExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { scope } = useAdminSession();
  const meta = useAuditMeta(scope);

  // Filters live in the URL so a filtered view is a shareable link.
  const urlFilters = useMemo(
    () => ({
      action: params.getAll('action').flatMap((a) => a.split(',')).filter(Boolean),
      q: params.get('q') ?? '',
      ip: params.get('ip') ?? '',
      actorId: params.get('actorId') ?? '',
      targetId: params.get('targetId') ?? '',
      period: params.get('period') ?? 'any',
    }),
    [params]
  );

  const setUrl = (patch: Partial<typeof urlFilters>) => {
    const next = { ...urlFilters, ...patch };
    const query = qs({
      action: next.action.length ? next.action : undefined,
      q: next.q || undefined,
      ip: next.ip || undefined,
      actorId: next.actorId || undefined,
      targetId: next.targetId || undefined,
      period: next.period === 'any' ? undefined : next.period,
    });
    router.replace(`${pathname}${query}`, { scroll: false });
  };

  const [searchDraft, setSearchDraft] = useState(urlFilters.q);
  const q = useDebounced(searchDraft.trim(), 300);
  // Push the settled search term into the URL. Only q drives this; the other filters are read
  // fresh inside setUrl.
  useEffect(() => {
    if (q !== urlFilters.q) setUrl({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // The period's start is fixed per selection so the query key stays stable between renders.
  const from = useMemo(() => periodStart(urlFilters.period), [urlFilters.period]);

  const filters: AuditFilters = {
    action: urlFilters.action.length ? urlFilters.action : undefined,
    q: urlFilters.q || undefined,
    ip: urlFilters.ip || undefined,
    actorId: urlFilters.actorId || undefined,
    targetId: urlFilters.targetId || undefined,
    from,
  };

  const chips = [
    urlFilters.ip && { key: 'ip', label: `IP ${urlFilters.ip}` },
    urlFilters.actorId && { key: 'actorId', label: `Actor ${urlFilters.actorId.slice(0, 8)}…` },
    urlFilters.targetId && { key: 'targetId', label: `Target ${urlFilters.targetId.slice(0, 8)}…` },
  ].filter(Boolean) as { key: 'ip' | 'actorId' | 'targetId'; label: string }[];

  const anyFilter = chips.length > 0 || urlFilters.action.length > 0 || urlFilters.q || urlFilters.period !== 'any';

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiFetch(`/api/admin/audit/export.csv${qs({ platformId: scopeParam(scope), ...filters })}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
      }
      const blob = await res.blob();
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'audit-log.csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export ready', { description: name });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every sign-in, permission change and admin action, newest first. Click an event for full detail."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search email, IP, id…"
          className="h-8 w-full sm:w-64"
        />
        <ActionFilter value={urlFilters.action} onChange={(action) => setUrl({ action })} actions={meta.data?.actions ?? []} />
        <Select value={urlFilters.period} onValueChange={(period) => setUrl({ period })}>
          <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {chips.map((c) => (
          <span key={c.key} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 pl-2.5 pr-1 font-mono text-xs text-primary">
            {c.label}
            <button className="rounded p-0.5 hover:bg-primary/20" onClick={() => setUrl({ [c.key]: '' })} aria-label={`Remove ${c.label}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {anyFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              setSearchDraft('');
              router.replace(pathname, { scroll: false });
            }}
          >
            Reset
          </Button>
        )}
      </div>

      <AuditTable
        scope={scope}
        filters={filters}
        showPlatform={scope === ALL_PLATFORMS}
        onFilter={(f) => setUrl({ ip: f.ip ?? urlFilters.ip, actorId: f.actorId ?? urlFilters.actorId, targetId: f.targetId ?? urlFilters.targetId })}
      />
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <AuditExplorer />
    </Suspense>
  );
}
