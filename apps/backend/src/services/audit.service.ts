import { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

// The single list of actions the system records. Exported as a value (not just a type) so the
// admin audit explorer can offer exactly these as filters via GET /api/admin/audit/meta.
export const AUDIT_ACTIONS = [
  'PLATFORM_CREATED',
  'PLATFORM_SETTINGS_CHANGED',
  'PLATFORM_SECURITY_CHANGED',
  'PLATFORM_DELETED',
  'INVITE_CREATED',
  'INVITE_REVOKED',
  'INVITE_KEY_CREATED',
  'INVITE_KEY_REVOKED',
  'USER_JOINED_PLATFORM',
  'USER_ADDED_TO_PLATFORM',
  'USER_SELF_REGISTERED',
  'USER_ROLE_CHANGED',
  'USER_REMOVED_FROM_PLATFORM',
  'USER_DISABLED',
  'USER_ENABLED',
  'USER_SESSIONS_REVOKED_BY_ADMIN',
  'VERIFICATION_RESENT_BY_ADMIN',
  'EMAIL_VERIFIED',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'LOGIN_BLOCKED_UNVERIFIED',
  'LOGIN_BLOCKED_DISABLED',
  'LOGIN_DENIED_NO_ACCESS',
  'SESSION_REVOKED',
  'SUPER_ADMIN_GRANTED',
  'SUPER_ADMIN_REVOKED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

interface LogActivityParams {
  action: AuditAction;
  platformId?: string | null;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, Prisma.InputJsonValue>;
  // When given, the client IP and user agent are recorded with the row.
  req?: Request;
}

// Audit logging must never break the action it's recording, so failures are caught and logged.
export async function logActivity(params: LogActivityParams) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        platformId: params.platformId ?? null,
        actorId: params.actorId ?? null,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata,
        ipAddress: params.req ? clientIp(params.req) : null,
        userAgent: params.req ? truncate(params.req.headers['user-agent'], 512) : null,
      },
    });
  } catch (error) {
    console.error('logActivity error:', error);
  }
}

// req.ip honours `trust proxy`, so behind nginx this is the client rather than the proxy.
export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

function truncate(value: string | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}
