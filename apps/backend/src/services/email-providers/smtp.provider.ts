import nodemailer from 'nodemailer';
import { EmailService } from '../email.service';

export class SmtpProvider implements EmailService {
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor() {
    // General SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    this.fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@vyntrise.com';
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Vyntrise" <${this.fromAddress}>`,
      to,
      subject: 'Reset your Vyntrise password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #18181b;">Reset your password</h2>
          <p style="color: #52525b;">You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetLink}"
             style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                    background: #18181b; color: #fafafa; text-decoration: none;
                    border-radius: 6px; font-weight: 600;">
            Reset Password
          </a>
          <p style="color: #a1a1aa; font-size: 13px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Or copy this link: <a href="${resetLink}" style="color: #6366f1;">${resetLink}</a>
          </p>
        </div>
      `,
    });
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void> {
    const message = (to: string, changed: string) => ({
      from: `"Vyntrise" <${this.fromAddress}>`,
      to,
      subject: 'Your Vyntrise email address was changed',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #18181b;">Email address changed</h2>
          <p style="color: #52525b;">
            The email address on your Vyntrise account has been updated to
            <strong>${changed}</strong>.
          </p>
          <p style="color: #52525b;">
            If you did not make this change, please contact support immediately.
          </p>
        </div>
      `,
    });

    await Promise.all([
      this.transporter.sendMail(message(oldEmail, newEmail)),
      this.transporter.sendMail(message(newEmail, newEmail)),
    ]);
  }

  async sendInviteEmail(to: string, registerLink: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Vyntrise" <${this.fromAddress}>`,
      to,
      subject: "You've been invited to Vyntrise",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #18181b;">You're invited to Vyntrise</h2>
          <p style="color: #52525b;">You've been invited to join a platform on Vyntrise. Click the button below to create your account. This link expires in 7 days.</p>
          <a href="${registerLink}"
             style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                    background: #18181b; color: #fafafa; text-decoration: none;
                    border-radius: 6px; font-weight: 600;">
            Accept Invitation
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 32px;">
            Or copy this link: <a href="${registerLink}" style="color: #6366f1;">${registerLink}</a>
          </p>
        </div>
      `,
    });
  }
}
