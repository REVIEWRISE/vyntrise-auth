'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Filter, Loader2, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuditLog, type AuditEntry, type AuditFilters } from '@/lib/admin-api';
import { ActivityIcon, activityMeta, describeActivity } from '@/components/admin/activity';
import { EmptyState, ErrorState } from '@/components/admin/primitives';
import { RelativeTime, UserAgentLabel, formatDateTime } from '@/components/admin/format';
import { cn } from '@/lib/utils';

// Syntax-tinted JSON for audit metadata; values only, no evaluation.
export function JsonViewer({ value }: { value: unknown }) {
  const json = JSON.stringify(value ?? {}, null, 2);
  const html = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g, (m, str, colon, lit, num) => {
      if (str) return colon ? `<span class="text-primary">${str}</span>${colon}` : `<span class="text-success">${str}</span>`;
      if (lit) return `<span class="text-warning">${lit}</span>`;
      if (num) return `<span class="text-[color:var(--chart-1)]">${num}</span>`;
      return m;
    });
  return (
    <pre
      className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function AuditDetailSheet({
  entry,
  onOpenChange,
  onFilter,
}: {
  entry: AuditEntry | null;
  onOpenChange: (open: boolean) => void;
  onFilter?: (filters: AuditFilters) => void;
}) {
  const meta = entry ? activityMeta(entry.action) : null;
  return (
    <Sheet open={!!entry} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0">
        {entry && meta && (
          <>
            <SheetHeader className="border-b p-6">
              <div className="flex items-center gap-3">
                <ActivityIcon action={entry.action} className="h-10 w-10" />
                <div className="min-w-0">
                  <SheetTitle>{meta.label}</SheetTitle>
                  <SheetDescription className="font-mono text-xs">{entry.action}</SheetDescription>
                </div>
              </div>
              <p className="pt-3 text-sm">{describeActivity(entry)}</p>
            </SheetHeader>
            <dl className="divide-y px-6 py-2">
              <Field label="When">{formatDateTime(entry.createdAt)}</Field>
              <Field label="Platform">{entry.platformName ?? <span className="text-muted-foreground">— (global)</span>}</Field>
              <Field label="Actor">
                {entry.actorId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/users/${entry.actorId}`} className="text-primary hover:underline">
                      {entry.actorEmail ?? entry.actorId}
                    </Link>
                    {onFilter && (
                      <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onFilter({ actorId: entry.actorId! })}>
                        <Filter className="h-3 w-3" /> only this actor
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">System / anonymous</span>
                )}
              </Field>
              <Field label="Target">
                {entry.targetType ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{entry.targetType}</span>
                    {entry.targetId &&
                      (entry.targetType === 'user' ? (
                        <Link href={`/admin/users/${entry.targetId}`} className="font-mono text-xs text-primary hover:underline">{entry.targetId}</Link>
                      ) : entry.targetType === 'platform' ? (
                        <Link href={`/admin/platforms/${entry.targetId}`} className="font-mono text-xs text-primary hover:underline">{entry.targetId}</Link>
                      ) : (
                        <span className="font-mono text-xs">{entry.targetId}</span>
                      ))}
                    {onFilter && entry.targetId && (
                      <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onFilter({ targetId: entry.targetId! })}>
                        <Filter className="h-3 w-3" /> only this target
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="IP address">
                {entry.ipAddress ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{entry.ipAddress}</span>
                    {onFilter && (
                      <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onFilter({ ip: entry.ipAddress! })}>
                        <Filter className="h-3 w-3" /> only this IP
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not recorded</span>
                )}
              </Field>
              <Field label="Client">{entry.userAgent ? <UserAgentLabel ua={entry.userAgent} /> : <span className="text-muted-foreground">Not recorded</span>}</Field>
              <Field label="Event ID">
                <button
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(entry.id);
                    toast.success('Event ID copied');
                  }}
                >
                  {entry.id} <Copy className="h-3 w-3" />
                </button>
              </Field>
            </dl>
            <div className="px-6 pb-6 pt-2">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Metadata</h3>
              <JsonViewer value={entry.metadata} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Infinite audit list: loads the next page as the sentinel scrolls into view.
export function AuditTable({
  scope,
  filters,
  showPlatform,
  onFilter,
  compact,
}: {
  scope: string;
  filters: AuditFilters;
  showPlatform?: boolean;
  onFilter?: (filters: AuditFilters) => void;
  compact?: boolean;
}) {
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAuditLog(scope, filters);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="glass overflow-hidden rounded-xl">
      {isLoading ? (
        <div className="space-y-px">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events match" description="Try widening the date range or clearing filters." />
      ) : (
        <ul className="divide-y">
          {rows.map((entry) => (
            <li key={entry.id}>
              <button
                onClick={() => setSelected(entry)}
                className={cn('flex w-full items-center gap-3 px-4 text-left transition-colors hover:bg-accent/40', compact ? 'py-2' : 'py-2.5')}
              >
                <ActivityIcon action={entry.action} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{describeActivity(entry)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-mono">{entry.action}</span>
                    {showPlatform && entry.platformName && <span>· {entry.platformName}</span>}
                    {entry.ipAddress && <span className="font-mono">· {entry.ipAddress}</span>}
                  </p>
                </div>
                <RelativeTime value={entry.createdAt} className="shrink-0 text-xs text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={sentinel} />
      {hasNextPage && (
        <div className="flex justify-center border-t p-3">
          <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="animate-spin" />}
            Load more
          </Button>
        </div>
      )}
      <AuditDetailSheet
        entry={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onFilter={
          onFilter &&
          ((f) => {
            setSelected(null);
            onFilter(f);
          })
        }
      />
    </div>
  );
}
