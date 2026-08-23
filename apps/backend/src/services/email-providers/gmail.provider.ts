import nodemailer from 'nodemailer';
import { NodemailerEmailProvider } from './base.provider';

export class GmailProvider extends NodemailerEmailProvider {
  protected transporter: nodemailer.Transporter;
  protected fromAddress: string;
  protected logPrefix = '[GmailProvider]';

  constructor() {
    super();
    console.log('[GmailProvider] Initializing Gmail email provider');
    console.log('[GmailProvider] Gmail User:', process.env.GMAIL_USER);

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your account password)
      },
    });

    this.fromAddress = process.env.GMAIL_USER || '';

    // Verify connection on initialization
    this.transporter.verify((error) => {
      if (error) {
        console.error('[GmailProvider] ❌ Connection failed:', error.message);
      } else {
        console.log('[GmailProvider] ✅ Gmail connection verified and ready to send emails');
      }
    });
  }
}
