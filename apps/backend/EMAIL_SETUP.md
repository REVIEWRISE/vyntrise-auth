# Email Configuration Guide

The Vyntrise auth service supports multiple email providers for sending transactional emails (password resets, invitations, security notifications).

## Sender Configuration

These apply to every provider:

```env
EMAIL_FROM=noreply@vyntrise.com
EMAIL_FROM_NAME=Vyntrise
FRONTEND_URL=https://auth.vyntrise.com
```

- **EMAIL_FROM**: the address mail is sent from. Defaults to `SMTP_USER`/`GMAIL_USER`, but **only when that value is itself an email address** — providers like SendGrid authenticate as the literal username `apikey`, so with those you must set `EMAIL_FROM` explicitly.
- **EMAIL_FROM_NAME**: display name in the From header. Defaults to `Vyntrise`.
- **FRONTEND_URL**: base URL for every link in an email. If unset, reset and invitation links point at `localhost` and are useless in production.

## Misconfiguration Behaviour

If the selected provider is missing credentials, the service **logs an error and falls back to the console provider** rather than refusing to start — a broken mailer should not take sign-in down with it. This means a misconfigured deploy looks healthy while silently sending nothing, so **check the boot log** after any change:

```
[email] provider=smtp from="Vyntrise <noreply@vyntrise.com>" links=https://auth.vyntrise.com
[SmtpProvider] ✅ Connection verified, ready to send
```

A fallback looks like this instead:

```
[email] ⚠️  EMAIL_PROVIDER=smtp but SMTP_PASSWORD is not set.
[email] ⚠️  Falling back to the console provider — no mail will actually be sent.
```

Running in production on the console provider logs its own explicit warning.

## Available Providers

### 1. Console (Development Default)

Logs all emails to the console instead of sending them. Perfect for local development.

```env
EMAIL_PROVIDER=console
```

No additional configuration needed.

---

### 2. SMTP (Generic - Recommended for Production)

Works with any SMTP server (SendGrid, Mailgun, AWS SES, custom SMTP, etc.).

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@vyntrise.com
```

#### Configuration Details:

- **SMTP_HOST**: Your SMTP server hostname
- **SMTP_PORT**: Usually `587` (TLS) or `465` (SSL)
- **SMTP_SECURE**: Optional. Defaults to `true` for port 465 and `false` otherwise; set it only to override that
- **SMTP_USER**: SMTP authentication username (usually your email)
- **SMTP_PASSWORD**: SMTP authentication password or API key
- **SMTP_FROM**: (Optional) Legacy alias for `EMAIL_FROM`; prefer `EMAIL_FROM`

#### Common SMTP Providers:

##### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

##### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.com
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

##### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

##### Custom SMTP Server
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@yourdomain.com
```

---

### 3. Gmail (Simple Setup for Small Projects)

Uses Gmail's SMTP service. Requires a Gmail account and an App Password.

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

#### How to Get a Gmail App Password:

1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification** (must be enabled)
3. Scroll down to **App passwords**
4. Generate a new app password for "Mail"
5. Copy the 16-character password (without spaces)

**Note**: Gmail has sending limits (500 emails/day for free accounts). Not recommended for production.

---

## Emails Sent

Every message is rendered from `src/services/email-templates/` and sent as HTML with a plain-text alternative (HTML-only mail is scored as spam by most filters).

| Email | Trigger | Recipient |
|---|---|---|
| Password reset | `POST /api/auth/forgot-password` | The account address (expires in 1 hour) |
| Invitation | Admin creates an invite | The invited address (expires in 7 days) |
| Welcome | Self-registration on a platform | The new account |
| Email address changed | `PATCH /api/account/email` | **Both** the old and new addresses |
| Password changed | `PATCH /api/account/password` | The account address |
| Signed out everywhere | `DELETE /api/account/sessions` | The account address |
| Role changed | Admin changes a member's role | The affected member |
| Access removed | Admin removes a member | The affected member |

The last five are security notifications: they exist so a user finds out when someone else changes their account. They are sent **fire-and-forget** via `notify()` — a bounced notification never turns a successful action into a 500. Password resets are the exception and are awaited, because delivery is the entire point of that request.

### Adding a new email

1. Add a template function to `src/services/email-templates/index.ts` returning `render({ subject, title, preheader, paragraphs, action?, footnote? })`.
2. Add a method to `emailService` in `src/services/email.service.ts`.
3. Call it from the controller with `notify('label', () => emailService.sendX(...))`.

All interpolated values are HTML-escaped by the renderer. Wrap a phrase in `*asterisks*` for bold; it degrades to plain text in the text alternative.

---

## Testing Email Configuration

After configuring your provider:

1. **Check the boot log** for the `[email] provider=...` line and the `✅ Connection verified` line. This catches credential problems before any user hits them.
2. Trigger a password reset from the login page.
3. Create an invitation from the admin panel.
4. Check your inbox — or, with the `console` provider, the server logs, which print the full message body including the link.

Note that the real providers deliberately log only the subject and recipient. Bodies carry single-use reset and invitation tokens, so logging them would put working credentials into the log pipeline. Only the `console` provider prints bodies, and it never actually sends.

---

## Production Recommendations

1. **Use SMTP provider** with a transactional email service (SendGrid, Mailgun, AWS SES)
2. **Configure SPF, DKIM, and DMARC** records for your domain
3. **Use environment variables** or a secret manager for credentials
4. **Monitor email delivery** and bounce rates
5. **Set the deployment secrets**: `EMAIL_PROVIDER`, `EMAIL_FROM`, `FRONTEND_URL`, and either the `SMTP_*` or `GMAIL_*` group. These are read from GitHub Actions secrets in `.github/workflows/ci.yml` and passed to the container by `docker-compose.yml`; a variable missing from either file never reaches the app.

---

## Troubleshooting

### Emails not sending with SMTP

- Verify SMTP credentials are correct
- Check if your SMTP provider requires whitelisting your server IP
- Ensure firewall allows outbound connections on the SMTP port
- Try enabling `SMTP_SECURE=true` if using port 465

### Gmail authentication errors

- Ensure 2-Step Verification is enabled
- Use an App Password, not your regular password
- Check if "Less secure app access" needs to be enabled (older accounts)

### Emails going to spam

- Configure SPF, DKIM, and DMARC DNS records
- Use a verified domain with your SMTP provider
- Avoid spam trigger words in email content
- Maintain a good sender reputation
