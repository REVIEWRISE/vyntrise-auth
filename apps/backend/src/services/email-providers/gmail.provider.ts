import nodemailer from 'nodemailer';
import { EmailService } from '../email.service';

export class GmailProvider implements EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    console.log('[GmailProvider] Initializing Gmail email provider');
    console.log('[GmailProvider] Gmail User:', process.env.GMAIL_USER);
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your account password)
      },
    });
    
    // Verify connection on initialization
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('[GmailProvider] ❌ Connection failed:', error.message);
      } else {
        console.log('[GmailProvider] ✅ Gmail connection verified and ready to send emails');
      }
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    console.log('[GmailProvider] 📧 Preparing password reset email');
    console.log('[GmailProvider] To:', to);
    console.log('[GmailProvider] Reset Link:', resetLink);
    
    try {
      const info = await this.transporter.sendMail({
        from: `"Vyntrise" <${process.env.GMAIL_USER}>`,
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
      
      console.log('[GmailProvider] ✅ Password reset email sent successfully');
      console.log('[GmailProvider] Message ID:', info.messageId);
      console.log('[GmailProvider] Response:', info.response);
    } catch (error) {
      console.error('[GmailProvider] ❌ Failed to send password reset email');
      console.error('[GmailProvider] Error:', error);
      throw error;
    }
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void> {
    console.log('[GmailProvider] 📧 Preparing email change notification');
    console.log('[GmailProvider] Old Email:', oldEmail);
    console.log('[GmailProvider] New Email:', newEmail);
    
    const message = (to: string, changed: string) => ({
      from: `"Vyntrise" <${process.env.GMAIL_USER}>`,
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

    try {
      const results = await Promise.all([
        this.transporter.sendMail(message(oldEmail, newEmail)),
        this.transporter.sendMail(message(newEmail, newEmail)),
      ]);
      
      console.log('[GmailProvider] ✅ Email change notifications sent successfully');
      console.log('[GmailProvider] Sent to old email:', oldEmail);
      console.log('[GmailProvider] Sent to new email:', newEmail);
    } catch (error) {
      console.error('[GmailProvider] ❌ Failed to send email change notification');
      console.error('[GmailProvider] Error:', error);
      throw error;
    }
  }

  async sendInviteEmail(to: string, registerLink: string): Promise<void> {
    console.log('[GmailProvider] 📧 Preparing invitation email');
    console.log('[GmailProvider] To:', to);
    console.log('[GmailProvider] Register Link:', registerLink);
    
    try {
      const info = await this.transporter.sendMail({
        from: `"Vyntrise" <${process.env.GMAIL_USER}>`,
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
      
      console.log('[GmailProvider] ✅ Invitation email sent successfully');
      console.log('[GmailProvider] Message ID:', info.messageId);
      console.log('[GmailProvider] Response:', info.response);
    } catch (error) {
      console.error('[GmailProvider] ❌ Failed to send invitation email');
      console.error('[GmailProvider] Error:', error);
      throw error;
    }
  }
}
