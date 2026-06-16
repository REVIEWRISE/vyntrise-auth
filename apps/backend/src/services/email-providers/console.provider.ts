import { EmailService } from '../email.service';

export class ConsoleEmailProvider implements EmailService {
  constructor() {
    console.log('[ConsoleEmailProvider] ⚠️ Initializing Console email provider (development only)');
    console.log('[ConsoleEmailProvider] Emails will be logged to console, not actually sent');
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    console.log('[ConsoleEmailProvider] 📧 Password Reset Email (NOT SENT)');
    console.log('[ConsoleEmailProvider] To:', to);
    console.log('[ConsoleEmailProvider] Reset Link:', resetLink);
    console.log('[ConsoleEmailProvider] ✅ Logged to console (email not actually sent)');
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void> {
    console.log('[ConsoleEmailProvider] 📧 Email Change Notification (NOT SENT)');
    console.log('[ConsoleEmailProvider] Old Email:', oldEmail);
    console.log('[ConsoleEmailProvider] New Email:', newEmail);
    console.log('[ConsoleEmailProvider] ✅ Logged to console (emails not actually sent)');
  }

  async sendInviteEmail(to: string, registerLink: string): Promise<void> {
    console.log('[ConsoleEmailProvider] 📧 Invitation Email (NOT SENT)');
    console.log('[ConsoleEmailProvider] To:', to);
    console.log('[ConsoleEmailProvider] Register Link:', registerLink);
    console.log('[ConsoleEmailProvider] ✅ Logged to console (email not actually sent)');
  }
}
