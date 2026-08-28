import 'dotenv/config';

export type EmailProviderName = 'console' | 'smtp' | 'gmail';

const PROVIDERS: readonly EmailProviderName[] = ['console', 'smtp', 'gmail'];

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface GmailSettings {
  user: string;
  appPassword: string;
}

export interface EmailConfig {
  /** The provider actually in use. Falls back to 'console' when the requested one is unusable. */
  provider: EmailProviderName;
  /** What EMAIL_PROVIDER asked for, before any fallback — used for the boot diagnostics. */
  requested: EmailProviderName | string;
  fromName: string;
  fromAddress: string;
  /** Base URL every link in an email is built from. */
  appUrl: string;
  smtp?: SmtpSettings;
  gmail?: GmailSettings;
  /** Non-empty when the requested provider was misconfigured; each entry is user-facing text. */
  problems: string[];
}

function missing(...keys: string[]): string[] {
  return keys.filter((key) => !process.env[key]?.trim());
}

// SMTP ports carry their own convention: 465 is implicit TLS, everything else upgrades with
// STARTTLS. Defaulting from the port means a correct setup needs one less variable.
function resolveSecure(port: number): boolean {
  const explicit = process.env.SMTP_SECURE?.trim();
  if (explicit) return explicit === 'true';
  return port === 465;
}

export function loadEmailConfig(): EmailConfig {
  const requested = process.env.EMAIL_PROVIDER?.trim() || 'console';
  const problems: string[] = [];

  let provider: EmailProviderName = 'console';
  let smtp: SmtpSettings | undefined;
  let gmail: GmailSettings | undefined;

  if (!PROVIDERS.includes(requested as EmailProviderName)) {
    problems.push(
      `EMAIL_PROVIDER="${requested}" is not recognised. Expected one of: ${PROVIDERS.join(', ')}.`
    );
  } else if (requested === 'smtp') {
    const absent = missing('SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD');
    if (absent.length > 0) {
      problems.push(`EMAIL_PROVIDER=smtp but ${absent.join(', ')} ${absent.length > 1 ? 'are' : 'is'} not set.`);
    } else {
      const port = Number.parseInt(process.env.SMTP_PORT?.trim() || '587', 10);
      if (Number.isNaN(port)) {
        problems.push(`SMTP_PORT="${process.env.SMTP_PORT}" is not a number.`);
      } else {
        provider = 'smtp';
        smtp = {
          host: process.env.SMTP_HOST!.trim(),
          port,
          secure: resolveSecure(port),
          user: process.env.SMTP_USER!.trim(),
          password: process.env.SMTP_PASSWORD!,
        };
      }
    }
  } else if (requested === 'gmail') {
    const absent = missing('GMAIL_USER', 'GMAIL_APP_PASSWORD');
    if (absent.length > 0) {
      problems.push(`EMAIL_PROVIDER=gmail but ${absent.join(', ')} ${absent.length > 1 ? 'are' : 'is'} not set.`);
    } else {
      provider = 'gmail';
      gmail = {
        user: process.env.GMAIL_USER!.trim(),
        appPassword: process.env.GMAIL_APP_PASSWORD!,
      };
    }
  }

  // Precedence runs specific -> generic: an explicit EMAIL_FROM always wins, otherwise the
  // authenticated mailbox is the only address the provider is guaranteed to let us send as.
  // The username is only usable as a From when it is itself an address — SendGrid and friends
  // authenticate as the literal string "apikey", which would build an invalid From header.
  const candidates = [
    process.env.EMAIL_FROM?.trim(),
    process.env.SMTP_FROM?.trim(),
    smtp?.user,
    gmail?.user,
  ];
  const fromAddress = candidates.find((value) => value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

  if (!fromAddress) {
    problems.push(
      'No usable sender address: set EMAIL_FROM to the address your provider is allowed to send as.'
    );
  }

  const appUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:3001').replace(/\/+$/, '');
  if (!process.env.FRONTEND_URL?.trim()) {
    problems.push('FRONTEND_URL is not set — reset and invitation links will point at localhost.');
  }

  return {
    provider,
    requested,
    fromName: process.env.EMAIL_FROM_NAME?.trim() || 'Vyntrise',
    fromAddress: fromAddress ?? 'noreply@vyntrise.com',
    appUrl,
    smtp,
    gmail,
    problems,
  };
}

export const emailConfig: EmailConfig = loadEmailConfig();

/**
 * Reports email configuration at boot. Deliberately does not exit: a misconfigured mailer
 * should not take sign-in down with it, so the service degrades to console logging and says
 * so loudly instead of crash-looping.
 */
export function reportEmailConfig(config: EmailConfig = emailConfig): void {
  for (const problem of config.problems) {
    console.error(`[email] ⚠️  ${problem}`);
  }

  if (config.problems.length > 0 && config.provider === 'console') {
    console.error('[email] ⚠️  Falling back to the console provider — no mail will actually be sent.');
  }

  if (config.provider === 'console' && process.env.NODE_ENV === 'production') {
    console.error(
      '[email] ⚠️  Running in production with the console provider. Password resets and ' +
      'invitations will never reach anyone. Set EMAIL_PROVIDER=smtp (or gmail).'
    );
  }

  console.log(
    `[email] provider=${config.provider} from="${config.fromName} <${config.fromAddress}>" links=${config.appUrl}`
  );
}
