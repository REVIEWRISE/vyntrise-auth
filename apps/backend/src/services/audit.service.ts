import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

export type AuditAction =
  | 'PLATFORM_CREATED'
  | 'INVITE_CREATED'
  | 'USER_JOINED_PLATFORM'
  | 'SESSION_REVOKED';

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
