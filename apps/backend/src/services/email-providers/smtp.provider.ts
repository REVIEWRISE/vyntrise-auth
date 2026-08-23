import nodemailer from 'nodemailer';
import { NodemailerEmailProvider } from './base.provider';

export class SmtpProvider extends NodemailerEmailProvider {
  protected transporter: nodemailer.Transporter;
  protected fromAddress: string;
  protected logPrefix = '[SmtpProvider]';

  constructor() {
    super();
    console.log('[SmtpProvider] Initializing SMTP email provider');
    console.log('[SmtpProvider] Host:', process.env.SMTP_HOST);
    console.log('[SmtpProvider] Port:', process.env.SMTP_PORT || '587');
    console.log('[SmtpProvider] User:', process.env.SMTP_USER);

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
    console.log('[SmtpProvider] From Address:', this.fromAddress);

    // Verify connection on initialization
    this.transporter.verify((error) => {
      if (error) {
        console.error('[SmtpProvider] ❌ Connection failed:', error.message);
      } else {
        console.log('[SmtpProvider] ✅ SMTP connection verified and ready to send emails');
      }
    });
  }
}
