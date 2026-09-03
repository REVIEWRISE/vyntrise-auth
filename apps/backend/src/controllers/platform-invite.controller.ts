import { Response } from 'express';
import { PlatformKeyRequest } from '../middlewares/platform-key.middleware';
import { createInvitation } from '../services/invite.service';

// Server-to-server invitation creation for a single platform. Everything about the invitation
// itself — the row, the 7-day expiry, the email, the fact that invited users skip email
// confirmation — comes from the shared createInvitation path, so an invite made here is the same
// object the admin form makes.

export const createInviteViaKey = async (req: PlatformKeyRequest, res: Response) => {
  try {
    // Set by authenticatePlatformKey, which has already confirmed it matches :platformId.
    // Taken from the key rather than the URL so the two can never drift apart here.
    const inviteKey = req.inviteKey!;
    const { email, role = 'USER' } = req.body ?? {};

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    // ADMIN grants access to this service's own admin panel. A platform's backend must not be
    // able to mint that for anyone, however it was compromised — so the cap is a hard reject
    // rather than a silent downgrade, which would hide a caller that thinks it is doing
    // something else.
    if (role !== 'USER') {
      return res.status(400).json({
        message: 'Role must be USER. Inviting an admin requires the admin panel.',
      });
    }

    const result = await createInvitation({
      platformId: inviteKey.platformId,
      email,
      role: 'USER',
      actorId: null, // No human behind this one; the key is identified in the audit metadata.
      origin: 'api',
      inviteKeyId: inviteKey.id,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.status(201).json({
      message: 'Invitation created',
      token: result.token,
      registerLink: result.registerLink,
    });
  } catch (error) {
    console.error('createInviteViaKey error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
