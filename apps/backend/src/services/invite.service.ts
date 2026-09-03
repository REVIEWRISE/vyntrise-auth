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
  | { ok: true; token: string; registerLink: string; invitationId: string }
  | { ok: false; status: number; message: string };

export async function createInvitation({
  platformId,
  email,
  role,
  actorId = null,
  origin,
  inviteKeyId,
}: CreateInvitationParams): Promise<CreateInvitationResult> {
  // An invite that is still live is not silently replaced — reissuing would invalidate the link
  // already sitting in the recipient's inbox.
  const existing = await prisma.invitation.findUnique({
    where: { email_platformId: { email, platformId } },
  });
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

  return { ok: true, token, registerLink, invitationId: invitation.id };
}
