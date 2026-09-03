import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

export type AuditAction =
  | 'PLATFORM_CREATED'
  | 'PLATFORM_SETTINGS_CHANGED'
  | 'INVITE_CREATED'
  | 'INVITE_REVOKED'
  | 'INVITE_KEY_CREATED'
  | 'INVITE_KEY_REVOKED'
  | 'USER_JOINED_PLATFORM'
  | 'USER_SELF_REGISTERED'
  | 'USER_ROLE_CHANGED'
  | 'USER_REMOVED_FROM_PLATFORM'
  | 'EMAIL_VERIFIED'
  | 'LOGIN_BLOCKED_UNVERIFIED'
  | 'SESSION_REVOKED'
  | 'LOGIN_FAILED';

interface LogActivityParams {
  action: AuditAction;
  platformId?: string | null;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, Prisma.InputJsonValue>;
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
      },
    });
  } catch (error) {
    console.error('logActivity error:', error);
  }
}
