import { EmailService } from '../email.service';

export class ConsoleEmailProvider implements EmailService {
  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    console.log(`[EMAIL] Password reset for ${to}: ${resetLink}`);
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void> {
    console.log(`[EMAIL] Email changed from ${oldEmail} to ${newEmail}`);
  }

  async sendInviteEmail(to: string, registerLink: string): Promise<void> {
    console.log(`[EMAIL] Invite for ${to}: ${registerLink}`);
  }
}
