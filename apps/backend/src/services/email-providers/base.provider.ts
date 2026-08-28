import nodemailer from 'nodemailer';
import { emailConfig } from '../../config/email';
import { EmailProvider, OutgoingEmail } from './provider';

// Shared send logic for any provider backed by a nodemailer transporter. Subclasses only
// build the transporter; every template and every call site goes through send().
export abstract class NodemailerEmailProvider implements EmailProvider {
  abstract readonly name: string;
  protected abstract transporter: nodemailer.Transporter;

  protected get logPrefix(): string {
    return `[${this.name}]`;
  }

  // Reports whether the transport can authenticate, without blocking startup on it.
  protected verify(): void {
    this.transporter.verify((error) => {
      if (error) {
        console.error(`${this.logPrefix} ❌ Connection failed: ${error.message}`);
      } else {
        console.log(`${this.logPrefix} ✅ Connection verified, ready to send`);
      }
    });
  }

  async send(message: OutgoingEmail): Promise<void> {
    // Subject and recipient only. Bodies carry reset and invitation tokens, so logging them
    // would put single-use credentials into the log pipeline.
    const info = await this.transporter.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    console.log(`${this.logPrefix} sent "${message.subject}" to ${message.to} (${info.messageId})`);
  }
}
