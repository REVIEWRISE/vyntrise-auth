import nodemailer from 'nodemailer';
import { GmailSettings } from '../../config/email';
import { NodemailerEmailProvider } from './base.provider';

export class GmailProvider extends NodemailerEmailProvider {
  readonly name = 'GmailProvider';
  protected transporter: nodemailer.Transporter;

  constructor(settings: GmailSettings) {
    super();
    console.log(`[GmailProvider] user=${settings.user}`);

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      // Gmail rejects the account password here; this must be a 16-character App Password.
      auth: { user: settings.user, pass: settings.appPassword },
    });

    this.verify();
  }
}
