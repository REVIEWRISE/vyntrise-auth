import nodemailer from 'nodemailer';
import { SmtpSettings } from '../../config/email';
import { NodemailerEmailProvider } from './base.provider';

export class SmtpProvider extends NodemailerEmailProvider {
  readonly name = 'SmtpProvider';
  protected transporter: nodemailer.Transporter;

  constructor(settings: SmtpSettings) {
    super();
    console.log(
      `[SmtpProvider] host=${settings.host}:${settings.port} secure=${settings.secure} user=${settings.user}`
    );

    this.transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.password },
    });

    this.verify();
  }
}
