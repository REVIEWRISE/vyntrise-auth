import { ConsoleEmailProvider } from './email-providers/console.provider';
import { GmailProvider } from './email-providers/gmail.provider';

export interface EmailService {
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
  sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void>;
  sendInviteEmail(to: string, registerLink: string): Promise<void>;
}

export function createEmailService(): EmailService {
  const provider = process.env.EMAIL_PROVIDER ?? 'console';
  switch (provider) {
    case 'gmail':
      return new GmailProvider();
    case 'console':
    default:
      return new ConsoleEmailProvider();
  }
}

export const emailService: EmailService = createEmailService();
