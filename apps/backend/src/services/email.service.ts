import { emailConfig } from '../config/email';
import { ConsoleEmailProvider } from './email-providers/console.provider';
import { GmailProvider } from './email-providers/gmail.provider';
import { SmtpProvider } from './email-providers/smtp.provider';
import { EmailProvider } from './email-providers/provider';
import * as templates from './email-templates';

export function createEmailProvider(): EmailProvider {
  // loadEmailConfig() has already downgraded provider to 'console' if the requested one was
  // missing credentials, so the settings for whichever branch we land in are guaranteed present.
  switch (emailConfig.provider) {
    case 'smtp':
      return new SmtpProvider(emailConfig.smtp!);
    case 'gmail':
      return new GmailProvider(emailConfig.gmail!);
    case 'console':
    default:
      return new ConsoleEmailProvider();
  }
}

export const emailProvider: EmailProvider = createEmailProvider();

export const emailService = {
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    return emailProvider.send({ to, ...templates.passwordResetEmail(resetLink) });
  },

  // Goes to both addresses: the new one confirms the change, the old one is the only warning
  // the original owner gets if the change wasn't theirs.
  async sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void> {
    const message = templates.emailChangedEmail(newEmail);
    await Promise.all([
      emailProvider.send({ to: oldEmail, ...message }),
      emailProvider.send({ to: newEmail, ...message }),
    ]);
  },

  sendInviteEmail(to: string, registerLink: string, platformName: string, role: string): Promise<void> {
    return emailProvider.send({ to, ...templates.inviteEmail({ registerLink, platformName, role }) });
  },

  sendWelcomeEmail(to: string, platformName: string, platformId: string): Promise<void> {
    const loginLink = `${emailConfig.appUrl}/login?platformId=${encodeURIComponent(platformId)}`;
    return emailProvider.send({ to, ...templates.welcomeEmail({ platformName, loginLink }) });
  },

  sendPasswordChangedEmail(to: string, otherDevicesSignedOut: number): Promise<void> {
    return emailProvider.send({ to, ...templates.passwordChangedEmail(otherDevicesSignedOut) });
  },

  sendRoleChangedEmail(to: string, platformName: string, role: string): Promise<void> {
    return emailProvider.send({ to, ...templates.roleChangedEmail({ platformName, role }) });
  },

  sendRemovedFromPlatformEmail(to: string, platformName: string): Promise<void> {
    return emailProvider.send({ to, ...templates.removedFromPlatformEmail(platformName) });
  },

  sendSessionsRevokedEmail(to: string, count: number): Promise<void> {
    return emailProvider.send({ to, ...templates.sessionsRevokedEmail(count) });
  },
};

export type EmailService = typeof emailService;

/**
 * Fire-and-forget send for notifications that must never affect the request that triggered
 * them — a bounced role-change notice should not turn a successful role change into a 500.
 * Errors are logged and swallowed. Use a plain `await` instead when delivery is the point of
 * the request, as it is for password resets.
 */
export function notify(label: string, send: () => Promise<void>): void {
  send().catch((error: unknown) => {
    console.error(`[email] ❌ ${label}:`, error instanceof Error ? error.message : error);
  });
}
