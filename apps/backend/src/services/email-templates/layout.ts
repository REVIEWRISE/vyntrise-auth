import { emailConfig } from '../../config/email';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailBody {
  subject: string;
  /** Big heading inside the email. */
  title: string;
  /** One-line summary most clients show next to the subject in the inbox list. */
  preheader: string;
  /** Body copy. Wrap a phrase in *asterisks* to emphasise it. */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Closing note, usually the "if this wasn't you" line. */
  footnote?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escaping runs first, so the only thing this can produce is <strong> — a stray asterisk in
// user-supplied text is cosmetic, never an injection.
function inlineMarkup(value: string): string {
  return escapeHtml(value).replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
}

function stripMarkup(value: string): string {
  return value.replace(/\*([^*]+)\*/g, '$1');
}

const TEXT = '#3f3f46';
const MUTED = '#a1a1aa';
const INK = '#18181b';

export function render(body: EmailBody): RenderedEmail {
  const paragraphs = body.paragraphs
    .map((p) => `<p style="margin: 0 0 16px; color: ${TEXT}; font-size: 15px; line-height: 1.6;">${inlineMarkup(p)}</p>`)
    .join('\n');

  const action = body.action
    ? `
          <a href="${escapeHtml(body.action.url)}"
             style="display: inline-block; margin: 8px 0 24px; padding: 12px 24px;
                    background: ${INK}; color: #fafafa; text-decoration: none;
                    border-radius: 6px; font-weight: 600; font-size: 15px;">
            ${escapeHtml(body.action.label)}
          </a>
          <p style="margin: 0 0 16px; color: ${MUTED}; font-size: 12px; line-height: 1.6;">
            Or paste this link into your browser:<br />
            <a href="${escapeHtml(body.action.url)}" style="color: #6366f1; word-break: break-all;">${escapeHtml(body.action.url)}</a>
          </p>`
    : '';

  const footnote = body.footnote
    ? `<p style="margin: 0; color: ${MUTED}; font-size: 13px; line-height: 1.6;">${inlineMarkup(body.footnote)}</p>`
    : '';

  const html = `<!doctype html>
<html>
  <body style="margin: 0; padding: 0; background: #f4f4f5;">
    <span style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(body.preheader)}</span>
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 10px; padding: 32px;">
        <h1 style="margin: 0 0 16px; color: ${INK}; font-size: 20px; font-weight: 700;">${escapeHtml(body.title)}</h1>
${paragraphs}${action}
        ${footnote}
      </div>
      <p style="margin: 24px 0 0; text-align: center; color: ${MUTED}; font-size: 12px;">
        Sent by ${escapeHtml(emailConfig.fromName)} · <a href="${escapeHtml(emailConfig.appUrl)}" style="color: ${MUTED};">${escapeHtml(emailConfig.appUrl)}</a>
      </p>
    </div>
  </body>
</html>`;

  const textParts = [
    body.title,
    '',
    ...body.paragraphs.map(stripMarkup),
    ...(body.action ? ['', `${body.action.label}: ${body.action.url}`] : []),
    ...(body.footnote ? ['', stripMarkup(body.footnote)] : []),
    '',
    '--',
    `Sent by ${emailConfig.fromName} · ${emailConfig.appUrl}`,
  ];

  return { subject: body.subject, html, text: textParts.join('\n') };
}
