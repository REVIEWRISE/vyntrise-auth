# Email Configuration Guide

The Vyntrise auth service supports multiple email providers for sending transactional emails (password resets, invitations, etc.).

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
- **SMTP_SECURE**: Set to `true` for port 465, `false` for other ports
- **SMTP_USER**: SMTP authentication username (usually your email)
- **SMTP_PASSWORD**: SMTP authentication password or API key
- **SMTP_FROM**: (Optional) The "from" address for emails. Defaults to SMTP_USER

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

## Email Templates

The service sends three types of emails:

1. **Password Reset Email**: Contains a secure link to reset password (expires in 1 hour)
2. **Email Change Notification**: Confirms email address changes
3. **Invitation Email**: Registration link for new users (expires in 7 days)

All emails use a clean, responsive HTML template.

---

## Testing Email Configuration

After configuring your provider, test it by:

1. Triggering a password reset from the login page
2. Creating an invitation from the admin panel
3. Checking the console logs (for `console` provider) or your inbox

---

## Production Recommendations

1. **Use SMTP provider** with a transactional email service (SendGrid, Mailgun, AWS SES)
2. **Configure SPF, DKIM, and DMARC** records for your domain
3. **Use environment variables** or a secret manager for credentials
4. **Monitor email delivery** and bounce rates
5. **Set up email templates** in your provider's dashboard for better tracking

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
