'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Fingerprint,
  KeyRound,
  Layers,
  LogIn,
  Mail,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL_PLATFORMS, useAdminSession } from './admin-session-context';
import {
  useAuditLog,
  usePlatformBreakdown,
  useSummary,
  useTimeseries,
  useTopFailures,
  type RangeKey,
} from '@/lib/admin-api';
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, StatCard } from '@/components/admin/primitives';
import { ChartLegend, RangeTabs, TrendChart, type Series } from '@/components/admin/charts';
import { ActivityIcon, describeActivity } from '@/components/admin/activity';
import { RelativeTime, formatDate, formatNumber } from '@/components/admin/format';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

const SIGNIN_SERIES: Series[] = [
  { key: 'logins', label: 'Successful sign-ins', color: 'var(--chart-1)' },
  { key: 'failed', label: 'Failed sign-ins', color: 'var(--chart-2)' },
];

const GROWTH_SERIES: Series[] = [
  { key: 'signups', label: 'New members', color: 'var(--chart-1)' },
  { key: 'invites', label: 'Invites sent', color: 'var(--chart-2)' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function sum(points: Record<string, unknown>[] | undefined, key: string) {
  return (points ?? []).reduce((s, p) => s + Number(p[key] ?? 0), 0);
}

export default function OverviewPage() {
  const { scope, platform, isSuperAdmin, me } = useAdminSession();
  const [range, setRange] = useState<RangeKey>('7d');

  const summary = useSummary(scope, range);
  const series = useTimeseries(scope, range);
  const recent = useAuditLog(scope, {}, 8);
  const breakdown = usePlatformBreakdown(range, isSuperAdmin && scope === ALL_PLATFORMS);

  const points = series.data?.points;
  const bucket = series.data?.bucket ?? 'day';
  const spark = (key: string) => points?.map((p) => Number(p[key as keyof typeof p] ?? 0));

  const totals = useMemo(
    () => Object.fromEntries(['logins', 'failed', 'signups', 'invites'].map((k) => [k, sum(points, k)])),
    [points]
  );

  const s = summary.data;
  const scopeName = scope === ALL_PLATFORMS ? 'all platforms' : platform?.name;
  const firstName = me.email.split('@')[0].split(/[._-]/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            {scope === ALL_PLATFORMS ? <Layers className="h-3 w-3" /> : null}
            {scopeName}
          </span>
        }
        title={
          <>
            {greeting()}, <span className="text-gradient capitalize">{firstName}</span>
          </>
        }
        description="Sign-in health, growth and recent activity at a glance."
        actions={<RangeTabs value={range} options={RANGES} onChange={setRange} />}
      />

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active users"
            icon={Fingerprint}
            loading={!s}
            value={s && formatNumber(s.activeUsers.value)}
            change={s?.activeUsers.change}
            hint={s && `of ${formatNumber(s.members.value)} members`}
            spark={spark('logins')}
          />
          <StatCard
            label="Successful sign-ins"
            icon={LogIn}
            loading={!s}
            value={s && formatNumber(s.logins.value)}
            change={s?.logins.change}
            hint={s && `${formatNumber(s.activeSessions.value)} sessions active this week`}
            spark={spark('logins')}
          />
          <StatCard
            label="Failed sign-in rate"
            icon={ShieldAlert}
            loading={!s}
            value={s && `${s.failedRate.value}%`}
            change={s?.failedRate.change}
            changeSuffix="pt"
            invert
            hint={s && `${formatNumber(s.failedLogins.value)} failed attempts`}
            spark={spark('failed')}
            sparkColor="var(--chart-2)"
          />
          <StatCard
            label="New members"
            icon={UserPlus}
            loading={!s}
            value={s && formatNumber(s.newMembers.value)}
            change={s?.newMembers.change}
            hint={s && `${formatNumber(s.pendingInvites.value)} invites pending`}
            spark={spark('signups')}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Sign-in activity"
            description={`Successful vs failed sign-ins, ${bucket === 'hour' ? 'per hour' : 'per day'}`}
            actions={<ChartLegend series={SIGNIN_SERIES} totals={totals} />}
          />
          <div className="px-3 pb-4">
            {points ? (
              <TrendChart data={points} series={SIGNIN_SERIES} bucket={bucket} kind="area" />
            ) : (
              <Skeleton className="mx-2 h-[260px]" />
            )}
          </div>
        </Panel>

        <SecuritySignals scope={scope} range={range} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Growth"
            description="New members and invitations sent"
            actions={<ChartLegend series={GROWTH_SERIES} totals={totals} />}
          />
          <div className="px-3 pb-4">
            {points ? (
              <TrendChart data={points} series={GROWTH_SERIES} bucket={bucket} kind="bar" height={240} />
            ) : (
              <Skeleton className="mx-2 h-[240px]" />
            )}
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader
            title="Recent activity"
            icon={Activity}
            actions={
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <Link href="/admin/audit">
                  View audit log <ArrowRight className="!size-3" />
                </Link>
              </Button>
            }
          />
          <div className="flex-1 px-2 pb-3">
            {recent.isLoading ? (
              <div className="space-y-2 px-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : recent.data?.pages[0]?.items.length ? (
              <ul>
                {recent.data.pages[0].items.map((log) => (
                  <li key={log.id} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/50">
                    <ActivityIcon action={log.action} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{describeActivity(log)}</p>
                      {scope === ALL_PLATFORMS && log.platformName && (
                        <p className="truncate text-xs text-muted-foreground">{log.platformName}</p>
                      )}
                    </div>
                    <RelativeTime value={log.createdAt} className="shrink-0 text-xs text-muted-foreground" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Activity} title="No activity yet" description="Sign-ins, invites and admin changes will appear here." />
            )}
          </div>
        </Panel>
      </div>

      {isSuperAdmin && scope === ALL_PLATFORMS && (
        <Panel>
          <PanelHeader title="Platforms" description={`Members and sign-ins per platform, last ${range}`} icon={Layers} />
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 text-right font-medium">Members</th>
                  <th className="px-3 py-2 text-right font-medium">Sign-ins</th>
                  <th className="px-3 py-2 text-right font-medium">Failed</th>
                  <th className="w-1/3 px-3 py-2 font-medium">Share of sign-ins</th>
                </tr>
              </thead>
              <tbody>
                {(breakdown.data ?? []).map((row) => {
                  const max = Math.max(1, ...(breakdown.data ?? []).map((r) => r.logins));
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/platforms/${row.id}`} className="font-medium hover:text-primary">
                          {row.name}
                        </Link>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{formatNumber(row.members)}</td>
                      <td className="tabular px-3 py-2.5 text-right">{formatNumber(row.logins)}</td>
                      <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{formatNumber(row.failed)}</td>
                      <td className="px-3 py-2.5">
                        <div className="h-1.5 rounded-full bg-muted">
                          <div className="h-1.5 rounded-full" style={{ width: `${(row.logins / max) * 100}%`, background: 'var(--chart-1)' }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {breakdown.isLoading && <Skeleton className="mx-3 my-2 h-24" />}
          </div>
        </Panel>
      )}

      {s?.trackingSince && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="h-3 w-3" />
          Sign-in analytics are recorded from {formatDate(s.trackingSince)}; earlier periods only include failures and admin events.
        </p>
      )}
    </div>
  );
}

function SecuritySignals({ scope, range }: { scope: string; range: RangeKey }) {
  const [kind, setKind] = useState<'failed_ips' | 'failed_emails'>('failed_emails');
  const top = useTopFailures(scope, kind, range);
  const items = top.data?.items ?? [];
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <Panel className="flex flex-col">
      <PanelHeader title="Security signals" description="Where failed sign-ins come from" icon={ShieldAlert} />
      <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="flex flex-1 flex-col px-5 pb-4">
        <TabsList>
          <TabsTrigger value="failed_emails"><Mail /> Accounts</TabsTrigger>
          <TabsTrigger value="failed_ips"><Users /> IP addresses</TabsTrigger>
        </TabsList>
        <TabsContent value={kind} className="mt-3 flex-1">
          {top.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="All quiet" description="No failed sign-ins in this period." className="py-8" />
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={`/admin/audit?action=LOGIN_FAILED&${kind === 'failed_ips' ? 'ip' : 'q'}=${encodeURIComponent(item.key)}`}
                    className="group block rounded-md px-2 py-1.5 hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-mono text-xs">{item.key}</span>
                      <span className="tabular shrink-0 text-xs font-medium">{item.count}</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-muted">
                      <div className="h-1 rounded-full" style={{ width: `${(item.count / max) * 100}%`, background: 'var(--chart-2)' }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </Panel>
  );
}
