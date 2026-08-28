import { EmailProvider, OutgoingEmail } from './provider';

// Development provider: prints the message instead of sending it. Unlike the real providers
// it does print the body, because seeing the reset/invite link is the whole point locally.
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'ConsoleEmailProvider';

  constructor() {
    console.log('[ConsoleEmailProvider] ⚠️  Emails are logged, not sent.');
  }

  async send(message: OutgoingEmail): Promise<void> {
    console.log(
      [
        '',
        '──────── EMAIL (not sent) ────────',
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
        '──────────────────────────────────',
        '',
      ].join('\n')
    );
  }
}
