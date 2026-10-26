import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { AdminRequest, AdminScope, resolveScope } from '../middlewares/admin.middleware';
import { AUDIT_ACTIONS } from '../services/audit.service';

const PAGE_MAX = 100;
const EXPORT_MAX_ROWS = 50_000;
const EXPORT_PAGE = 1000;

// Rows without a platform (failed logins with no platform named, CLI super-admin grants,
// deleted platforms) are cross-tenant by nature, so only a super-admin sees them.
function scopeWhere(scope: AdminScope): Prisma.AuditLogWhereInput {
  return scope.all ? {} : { platformId: { in: scope.platformIds } };
}

function asList(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return values.flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
}

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function buildWhere(req: AdminRequest, scope: AdminScope): Prisma.AuditLogWhereInput {
  const q = req.query;
  const and: Prisma.AuditLogWhereInput[] = [scopeWhere(scope)];

  const actions = asList(q.action);
  if (actions.length) and.push({ action: { in: actions } });
  if (typeof q.actorId === 'string' && q.actorId) and.push({ actorId: q.actorId });
  if (typeof q.targetType === 'string' && q.targetType) and.push({ targetType: q.targetType });
  if (typeof q.targetId === 'string' && q.targetId) and.push({ targetId: q.targetId });
  if (typeof q.ip === 'string' && q.ip) and.push({ ipAddress: q.ip });

  // "Involving this user": either they did it or it was done to them. Used by User 360.
  if (typeof q.userId === 'string' && q.userId) {
    and.push({ OR: [{ actorId: q.userId }, { targetType: 'user', targetId: q.userId }] });
  }

  const from = parseDate(q.from);
  const to = parseDate(q.to);
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } });

  if (typeof q.q === 'string' && q.q.trim()) {
    const term = q.q.trim();
    and.push({
      OR: [
        { actor: { email: { contains: term, mode: 'insensitive' } } },
        { metadata: { path: ['email'], string_contains: term } },
        { targetId: term },
        { ipAddress: term },
        { action: { contains: term.toUpperCase().replace(/\s+/g, '_') } },
      ],
    });
  }

  return { AND: and };
}

// Keyset cursor over (createdAt, id): stable under concurrent inserts and when many rows share
// a timestamp, which offset paging is not.
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

function cursorWhere(raw: unknown): Prisma.AuditLogWhereInput | null {
  if (typeof raw !== 'string' || !raw) return null;
  const [iso, id] = Buffer.from(raw, 'base64url').toString().split('|');
  const createdAt = new Date(iso);
  if (!id || Number.isNaN(createdAt.getTime())) return null;
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

const rowInclude = {
  actor: { select: { email: true } },
  platform: { select: { name: true } },
} satisfies Prisma.AuditLogInclude;

type Row = Prisma.AuditLogGetPayload<{ include: typeof rowInclude }>;

function serialize(row: Row) {
  return {
    id: row.id,
    action: row.action,
    createdAt: row.createdAt,
    platformId: row.platformId,
    platformName: row.platform?.name ?? null,
    actorId: row.actorId,
    actorEmail: row.actor?.email ?? null,
    targetType: row.targetType,
    targetId: row.targetId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata,
  };
}

function scopeOrReject(req: AdminRequest, res: Response): AdminScope | null {
  const scope = resolveScope(req);
  if (!scope) res.status(403).json({ message: 'Forbidden: Admin access required for this platform' });
  return scope;
}

// GET /api/admin/audit
export const listAuditLog = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), PAGE_MAX);
    const where = buildWhere(req, scope);
    const cursor = cursorWhere(req.query.cursor);
    if (cursor) (where.AND as Prisma.AuditLogWhereInput[]).push(cursor);

    const rows = await prisma.auditLog.findMany({
      where,
      include: rowInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      items: page.map(serialize),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    });
  } catch (error) {
    console.error('listAuditLog error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/admin/audit/meta
export const getAuditMeta = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const targetTypes = await prisma.auditLog.findMany({
      where: { ...scopeWhere(scope), targetType: { not: null } },
      distinct: ['targetType'],
      select: { targetType: true },
    });

    res.json({
      actions: AUDIT_ACTIONS,
      targetTypes: targetTypes.map((t) => t.targetType).filter(Boolean),
    });
  } catch (error) {
    console.error('getAuditMeta error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/admin/audit/:id
export const getAuditEntry = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const row = await prisma.auditLog.findFirst({
      where: { id: String(req.params.id), ...scopeWhere(scope) },
      include: rowInclude,
    });
    // 404 rather than 403 for out-of-scope rows, so ids from other platforms can't be probed.
    if (!row) return res.status(404).json({ message: 'Audit entry not found' });

    res.json(serialize(row));
  } catch (error) {
    console.error('getAuditEntry error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Spreadsheet apps execute cells starting with these as formulas, so an attacker-controlled
// value (an email address typed into a login form, say) could run in the admin's spreadsheet.
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS = [
  'createdAt', 'action', 'platformName', 'actorEmail', 'targetType', 'targetId',
  'ipAddress', 'userAgent', 'metadata',
] as const;

// GET /api/admin/audit/export.csv — same filters as the list, streamed in pages.
export const exportAuditLog = async (req: AdminRequest, res: Response) => {
  try {
    const scope = scopeOrReject(req, res);
    if (!scope) return;

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
    res.write(`${CSV_COLUMNS.join(',')}\n`);

    let written = 0;
    let cursor: Prisma.AuditLogWhereInput | null = null;

    while (written < EXPORT_MAX_ROWS) {
      const where = buildWhere(req, scope);
      if (cursor) (where.AND as Prisma.AuditLogWhereInput[]).push(cursor);

      const rows = await prisma.auditLog.findMany({
        where,
        include: rowInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.min(EXPORT_PAGE, EXPORT_MAX_ROWS - written),
      });
      if (rows.length === 0) break;

      const chunk = rows
        .map((row) => {
          const s = serialize(row) as Record<string, unknown>;
          s.createdAt = row.createdAt.toISOString();
          return CSV_COLUMNS.map((c) => csvCell(s[c])).join(',');
        })
        .join('\n');
      res.write(`${chunk}\n`);

      written += rows.length;
      const last = rows[rows.length - 1];
      cursor = cursorWhere(encodeCursor(last));
      if (rows.length < EXPORT_PAGE) break;
    }

    res.end();
  } catch (error) {
    console.error('exportAuditLog error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
    else res.end();
  }
};
