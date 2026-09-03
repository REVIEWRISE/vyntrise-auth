import crypto from 'crypto';
import prisma from '../db/prisma';
import { hashToken } from '../utils/token';

// Platform-scoped invite keys. A key authorises exactly one capability on exactly one platform:
// create an invitation for that platform. It is not an admin credential and deliberately cannot
// be widened — see platform-key.middleware.ts for where that is enforced per request.

// Recognisable in logs and secret scanners, and tells an operator what they are holding.
const KEY_PREFIX = 'vypk_';
// Kept in the clear so the admin page can say which key is live. 6 hex characters out of 64
// leaves 232 bits unknown, so this narrows nothing.
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 6;

export interface GeneratedInviteKey {
  /** The only time the raw key exists outside the caller's hands. Never stored. */
  rawKey: string;
  id: string;
  prefix: string;
  createdAt: Date;
}

/**
 * Issues a key for a platform, revoking whatever key it had. Returning the raw key is the whole
 * point of this call — it cannot be recovered afterwards, only replaced.
 */
export async function generateInviteKey(
  platformId: string,
  createdById: string | null
): Promise<GeneratedInviteKey> {
  const rawKey = `${KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;

  // Revoke and issue together: a half-applied rotation would either leave two live keys or none.
  const [, created] = await prisma.$transaction([
    prisma.platformInviteKey.updateMany({
      where: { platformId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.platformInviteKey.create({
      data: {
        platformId,
        keyHash: hashToken(rawKey),
        prefix: rawKey.slice(0, DISPLAY_PREFIX_LENGTH),
        createdById,
      },
    }),
  ]);

  return { rawKey, id: created.id, prefix: created.prefix, createdAt: created.createdAt };
}

/** The live key for a platform, or null. Never includes anything secret. */
export async function getActiveInviteKey(platformId: string) {
  const key = await prisma.platformInviteKey.findFirst({
    where: { platformId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, prefix: true, createdAt: true, lastUsedAt: true },
  });
  return key;
}

/** Returns the number of keys revoked, so the caller can distinguish "revoked" from "none". */
export async function revokeInviteKeys(platformId: string): Promise<number> {
  const { count } = await prisma.platformInviteKey.updateMany({
    where: { platformId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

/**
 * Resolves a presented key to its record, or null if it is unknown or revoked.
 *
 * Lookup is by digest on a unique column, so this neither leaks timing about which keys exist
 * nor needs to scan. The caller is still responsible for checking the key's platform against the
 * platform being acted on — a valid key is not by itself authorisation.
 */
export async function resolveInviteKey(rawKey: string) {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const key = await prisma.platformInviteKey.findUnique({
    where: { keyHash: hashToken(rawKey) },
    select: { id: true, platformId: true, revokedAt: true },
  });

  if (!key || key.revokedAt) return null;
  return key;
}

/** Best-effort "last seen" for the admin page. Never allowed to fail the request it belongs to. */
export function touchInviteKey(id: string): void {
  prisma.platformInviteKey
    .update({ where: { id }, data: { lastUsedAt: new Date() } })
    .catch((error: unknown) => console.error('touchInviteKey error:', error));
}
