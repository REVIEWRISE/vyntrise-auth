import crypto from 'crypto';
import prisma from '../db/prisma';
import { hashToken } from '../utils/token';
import { emailConfig } from '../config/email';
import { emailService, notify } from './email.service';
import { logActivity } from './audit.service';

// One invitation code path, shared by the human admin form and the platform-scoped API. Both
// must produce the same row, the same 7-day expiry, and the same email — an invite created by a
// machine has to be indistinguishable from one a human created, or the admin invites table and
// the Revoke action stop being trustworthy.

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteOrigin = 'admin' | 'api';

interface CreateInvitationParams {
  platformId: string;
  email: string;
  role: string;
  /** The admin who clicked Generate. Null for API-created invites, which have no user behind them. */
  actorId?: string | null;
  origin: InviteOrigin;
  /** Which platform invite key was used, when origin is 'api'. */
  inviteKeyId?: string;
}

type CreateInvitationResult =
  | { ok: true; granted: false; token: string; registerLink: string; invitationId: string }
  | { ok: true; granted: true; userId: string }
  | { ok: false; status: number; message: string };

export async function createInvitation({
  platformId,
  email,
  role,
  actorId = null,
  origin,
  inviteKeyId,
}: CreateInvitationParams): Promise<CreateInvitationResult> {
  const existing = await prisma.invitation.findUnique({
    where: { email_platformId: { email, platformId } },
  });

  // An address that already has an account is granted access on the spot. The invitation link
  // exists to create an account and prove the mailbox; an existing user has done both, and
  // making them redeem a link meant they were "added" but still locked out until they clicked
  // it. Checked before the live-invite guard so re-adding converts a pending invite too.
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    return grantExistingUser({ platformId, email, role, actorId, origin, inviteKeyId }, user.id, existing);
  }

  // An invite that is still live is not silently replaced — reissuing would invalidate the link
  // already sitting in the recipient's inbox.
  if (existing && !existing.isUsed && existing.expiresAt > new Date()) {
    return { ok: false, status: 409, message: 'An active invitation already exists for this email' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // Only the digest is persisted — the raw token exists solely in the link below.
  const storedToken = hashToken(token);

  const invitation = await prisma.invitation.upsert({
    where: { email_platformId: { email, platformId } },
    update: { token: storedToken, expiresAt, isUsed: false, role },
    create: { email, platformId, token: storedToken, expiresAt, role },
    include: { platform: { select: { name: true } } },
  });

  const registerLink = `${emailConfig.appUrl}/register?token=${token}`;

  // Same action for both origins so the audit trail stays one stream; `origin` says which door
  // it came through, rather than splitting it into a separate log the way a new action would.
  logActivity({
    action: 'INVITE_CREATED',
    platformId,
    actorId,
    targetType: 'invitation',
    targetId: invitation.id,
    metadata: inviteKeyId ? { email, role, origin, inviteKeyId } : { email, role, origin },
  });

  notify(`invitation to ${email}`, () =>
    emailService.sendInviteEmail(email, registerLink, invitation.platform.name, role)
  );

  return { ok: true, granted: false, token, registerLink, invitationId: invitation.id };
}

async function grantExistingUser(
  { platformId, email, role, actorId, origin, inviteKeyId }: CreateInvitationParams,
  userId: string,
  existingInvite: { id: string; isUsed: boolean } | null
): Promise<CreateInvitationResult> {
  const access = await prisma.userPlatformAccess.findUnique({
    where: { userId_platformId: { userId, platformId } },
  });
  if (access) {
    return { ok: false, status: 409, message: 'This user already has access to this platform' };
  }

  const platform = await prisma.platform.findUniqueOrThrow({
    where: { id: platformId },
    select: { name: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.userPlatformAccess.create({ data: { userId, platformId, role } });
    // Retire a pending invite for the same address so it leaves the pending list and its link
    // stops working — it would only grant what this just granted.
    if (existingInvite && !existingInvite.isUsed) {
      await tx.invitation.update({ where: { id: existingInvite.id }, data: { isUsed: true } });
    }
  });

  logActivity({
    action: 'USER_ADDED_TO_PLATFORM',
    platformId,
    actorId: actorId ?? null,
    targetType: 'user',
    targetId: userId,
    metadata: inviteKeyId ? { email, role, origin, inviteKeyId } : { email, role, origin },
  });

  notify(`added-to-platform notice to ${email}`, () =>
    emailService.sendAddedToPlatformEmail(email, platform.name, platformId, role)
  );

  return { ok: true, granted: true, userId };
}
