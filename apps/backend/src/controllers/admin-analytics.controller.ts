import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { AdminRequest, AdminScope, resolveScope } from '../middlewares/admin.middleware';
import { AuditAction } from '../services/audit.service';

// Analytics are derived entirely from AuditLog, so they only reach back as far as the events
// they count were recorded. LOGIN_SUCCEEDED in particular only exists from the release that
// introduced it; the console says "tracking since" for that reason.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const RANGES = {
  '24h': { ms: DAY, bucket: 'hour' },
  '7d': { ms: 7 * DAY, bucket: 'day' },
  '30d': { ms: 30 * DAY, bucket: 'day' },
  '90d': { ms: 90 * DAY, bucket: 'day' },
} as const;
type RangeKey = keyof typeof RANGES;

// Each chart series is a sum of one or more audit actions.
const METRICS: Record<string, AuditAction[]> = {
  logins: ['LOGIN_SUCCEEDED'],
  failed: ['LOGIN_FAILED'],
  blocked: ['LOGIN_BLOCKED_UNVERIFIED', 'LOGIN_BLOCKED_DISABLED', 'LOGIN_DENIED_NO_ACCESS'],
  signups: ['USER_SELF_REGISTERED', 'USER_JOINED_PLATFORM', 'USER_ADDED_TO_PLATFORM'],
  invites: ['INVITE_CREATED'],
};

function parseRange(raw: unknown): RangeKey {
  return typeof raw === 'string' && raw in RANGES ? (raw as RangeKey) : '30d';
}

function scopeOrReject(req: AdminRequest, res: Response): AdminScope | null {
  const scope = resolveScope(req);
  if (!scope) res.status(403).json({ message: 'Forbidden: Admin access required for this platform' });
  return scope;
}

function platformWhere(scope: AdminScope) {
  return scope.all ? {} : { platformId: { in: scope.platformIds } };
}

function platformSql(scope: AdminScope) {
  return scope.all ? Prisma.empty : Prisma.sql`AND "platformId" = ANY(${scope.platformIds})`;
}

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function countActions(scope: AdminScope, actions: AuditAction[], from: Date, to: Date) {
  return prisma.auditLog.count({
    where: { ...platformWhere(scope), action: { in: actions }, createdAt: { gte: from, lt: to } },
  });
}

async function distinctActors(scope: AdminScope, action: AuditAction, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(DISTINCT "actorId")::int AS n FROM "AuditLog"
    WHERE action = ${action} AND "createdAt" >= ${from} AND "createdAt" < ${to}
    ${platformSql(scope)}`;
  return Number(rows[0]?.n ?? 0);
}

async function newMembers(scope: AdminScope, from: Date, to: Date) {
  // Across all platforms "new member" means a new account; within one, a new membership.
  return scope.all
    ? prisma.user.count({ where: { createdAt: { gte: from, lt: to } } })
    : prisma.userPlatformAccess.count({
        where: { platformId: { in: scope.platformIds }, createdAt: { gte: from, lt: to } },
      });
}

// GET /api/admin/analytics/summary?range=&platformId=
export const getAnalyticsSummary = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const range = parseRange(req.query.range);
    const now = new Date();
    const from = new Date(now.getTime() - RANGES[range].ms);
    const prevFrom = new Date(from.getTime() - RANGES[range].ms);

    const memberWhere = scope.all ? {} : { platforms: { some: { platformId: { in: scope.platformIds } } } };

    const [
      members,
      disabledMembers,
      activeSessions,
      pendingInvites,
      logins, prevLogins,
      failed, prevFailed,
      active, prevActive,
      joined, prevJoined,
      firstTracked,
    ] = await Promise.all([
      prisma.user.count({ where: memberWhere }),
      prisma.user.count({ where: { ...memberWhere, disabledAt: { not: null } } }),
      prisma.session.count({
        where: { lastUsedAt: { gte: new Date(now.getTime() - 7 * DAY) }, user: memberWhere },
      }),
      prisma.invitation.count({
        where: { ...platformWhere(scope), isUsed: false, expiresAt: { gt: now } },
      }),
      countActions(scope, METRICS.logins, from, now),
      countActions(scope, METRICS.logins, prevFrom, from),
      countActions(scope, METRICS.failed, from, now),
      countActions(scope, METRICS.failed, prevFrom, from),
      distinctActors(scope, 'LOGIN_SUCCEEDED', from, now),
      distinctActors(scope, 'LOGIN_SUCCEEDED', prevFrom, from),
      newMembers(scope, from, now),
      newMembers(scope, prevFrom, from),
      prisma.auditLog.findFirst({
        where: { action: 'LOGIN_SUCCEEDED' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const attempts = logins + failed;
    const prevAttempts = prevLogins + prevFailed;
    const failedRate = attempts ? Math.round((failed / attempts) * 1000) / 10 : 0;
    const prevFailedRate = prevAttempts ? Math.round((prevFailed / prevAttempts) * 1000) / 10 : 0;

    res.json({
      range,
      trackingSince: firstTracked?.createdAt ?? null,
      members: { value: members, disabled: disabledMembers },
      activeSessions: { value: activeSessions },
      pendingInvites: { value: pendingInvites },
      logins: { value: logins, previous: prevLogins, change: changePct(logins, prevLogins) },
      failedLogins: { value: failed, previous: prevFailed, change: changePct(failed, prevFailed) },
      failedRate: { value: failedRate, previous: prevFailedRate, change: Math.round((failedRate - prevFailedRate) * 10) / 10 },
      activeUsers: { value: active, previous: prevActive, change: changePct(active, prevActive) },
      newMembers: { value: joined, previous: prevJoined, change: changePct(joined, prevJoined) },
    });
  } catch (error) {
    console.error('getAnalyticsSummary error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

function truncateUtc(date: Date, bucket: 'hour' | 'day'): number {
  const d = new Date(date);
  if (bucket === 'day') d.setUTCHours(0, 0, 0, 0);
  else d.setUTCMinutes(0, 0, 0);
  return d.getTime();
}

// GET /api/admin/analytics/timeseries?range=&platformId=
// One row per bucket with every metric, zero-filled so charts draw a continuous line.
export const getAnalyticsTimeseries = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const range = parseRange(req.query.range);
    const { ms, bucket } = RANGES[range];
    const now = new Date();
    const from = new Date(truncateUtc(new Date(now.getTime() - ms), bucket));

    const actionToMetric = new Map<string, string>();
    for (const [metric, actions] of Object.entries(METRICS)) {
      for (const action of actions) actionToMetric.set(action, metric);
    }

    // "createdAt" is stored as UTC without a zone, so date_trunc buckets in UTC — matching the
    // zero-fill below.
    const rows = await prisma.$queryRaw<{ bucket: Date; action: string; n: number }[]>`
      SELECT date_trunc(${bucket}, "createdAt") AS bucket, action, COUNT(*)::int AS n
      FROM "AuditLog"
      WHERE "createdAt" >= ${from} AND action = ANY(${[...actionToMetric.keys()]})
      ${platformSql(scope)}
      GROUP BY 1, 2`;

    const step = bucket === 'hour' ? HOUR : DAY;
    const series = new Map<number, Record<string, number>>();
    for (let t = from.getTime(); t <= now.getTime(); t += step) {
      series.set(t, Object.fromEntries(Object.keys(METRICS).map((m) => [m, 0])));
    }

    for (const row of rows) {
      const point = series.get(new Date(row.bucket).getTime());
      const metric = actionToMetric.get(row.action);
      if (point && metric) point[metric] += Number(row.n);
    }

    res.json({
      range,
      bucket,
      points: [...series.entries()].map(([t, values]) => ({ t: new Date(t).toISOString(), ...values })),
    });
  } catch (error) {
    console.error('getAnalyticsTimeseries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/admin/analytics/top?kind=failed_ips|failed_emails&range=&platformId=
// Where failed sign-ins are coming from: the first thing to look at during a credential-stuffing
// run.
export const getAnalyticsTop = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const range = parseRange(req.query.range);
    const from = new Date(Date.now() - RANGES[range].ms);
    const kind = req.query.kind === 'failed_emails' ? 'failed_emails' : 'failed_ips';

    const key = kind === 'failed_ips' ? Prisma.sql`"ipAddress"` : Prisma.sql`metadata->>'email'`;

    const rows = await prisma.$queryRaw<{ key: string | null; n: number; last: Date }[]>`
      SELECT ${key} AS key, COUNT(*)::int AS n, MAX("createdAt") AS last
      FROM "AuditLog"
      WHERE action = 'LOGIN_FAILED' AND "createdAt" >= ${from}
      ${platformSql(scope)}
      GROUP BY 1
      HAVING ${key} IS NOT NULL
      ORDER BY 2 DESC
      LIMIT 10`;

    res.json({
      kind,
      range,
      items: rows.map((r) => ({ key: r.key, count: Number(r.n), lastSeen: r.last })),
    });
  } catch (error) {
    console.error('getAnalyticsTop error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/admin/analytics/platforms — super-admin breakdown, one row per platform.
export const getPlatformBreakdown = async (req: AdminRequest, res: Response) => {
  try {
    const range = parseRange(req.query.range);
    const from = new Date(Date.now() - RANGES[range].ms);

    const rows = await prisma.$queryRaw<
      { id: string; name: string; members: number; logins: number; failed: number }[]
    >`
      SELECT p.id, p.name,
        (SELECT COUNT(*)::int FROM "UserPlatformAccess" u WHERE u."platformId" = p.id) AS members,
        (SELECT COUNT(*)::int FROM "AuditLog" a WHERE a."platformId" = p.id
           AND a.action = 'LOGIN_SUCCEEDED' AND a."createdAt" >= ${from}) AS logins,
        (SELECT COUNT(*)::int FROM "AuditLog" a WHERE a."platformId" = p.id
           AND a.action = 'LOGIN_FAILED' AND a."createdAt" >= ${from}) AS failed
      FROM "Platform" p
      ORDER BY logins DESC, members DESC`;

    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        members: Number(r.members),
        logins: Number(r.logins),
        failed: Number(r.failed),
      }))
    );
  } catch (error) {
    console.error('getPlatformBreakdown error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
