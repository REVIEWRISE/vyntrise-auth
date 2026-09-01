import { render, RenderedEmail } from './layout';

export { RenderedEmail } from './layout';

const IGNORE = "If you didn't request this, you can safely ignore this email.";
const CONTACT_ADMIN = "If this wasn't expected, contact your platform administrator.";
const SECURE_ACCOUNT = "If this wasn't you, reset your password immediately and sign out of all devices.";

export function passwordResetEmail(resetLink: string): RenderedEmail {
  return render({
    subject: 'Reset your Vyntrise password',
    title: 'Reset your password',
    preheader: 'Set a new password — this link expires in 1 hour.',
    paragraphs: [
      'You requested a password reset. Use the button below to choose a new password.',
      'This link expires in *1 hour* and can only be used once.',
    ],
    action: { label: 'Reset password', url: resetLink },
    footnote: IGNORE,
  });
}

export function verifyEmailEmail(params: { verifyLink: string; platformName: string }): RenderedEmail {
  return render({
    subject: 'Confirm your email address',
    title: 'Confirm your email address',
    preheader: 'One click activates your account — this link expires in 24 hours.',
    paragraphs: [
      `An account on *${params.platformName}* was created with this email address.`,
      'Confirm it below to activate the account and sign in.',
      'This link expires in *24 hours*.',
    ],
    action: { label: 'Confirm email address', url: params.verifyLink },
    // Deliberately not the generic IGNORE line: the reassurance that matters here is that
    // doing nothing leaves the account unusable, which is the whole point of the step.
    footnote: "If you didn't create this account, ignore this email — it stays inactive and nobody can sign in with it.",
  });
}

export function emailChangedEmail(newEmail: string): RenderedEmail {
  return render({
    subject: 'Your Vyntrise email address was changed',
    title: 'Email address changed',
    preheader: `Your account now signs in as ${newEmail}.`,
    paragraphs: [
      `The email address on your Vyntrise account has been changed to *${newEmail}*.`,
      'You will need to use the new address the next time you sign in.',
    ],
    footnote: SECURE_ACCOUNT,
  });
}

export function inviteEmail(params: {
  registerLink: string;
  platformName: string;
  role: string;
}): RenderedEmail {
  const asAdmin = params.role === 'ADMIN';
  return render({
    subject: `You've been invited to ${params.platformName}`,
    title: `You're invited to ${params.platformName}`,
    preheader: 'Create your account — this invitation expires in 7 days.',
    paragraphs: [
      `You've been invited to join *${params.platformName}* on Vyntrise${asAdmin ? ' as an *administrator*' : ''}.`,
      'Use the button below to create your account and set a password.',
      'This invitation expires in *7 days*.',
    ],
    action: { label: 'Accept invitation', url: params.registerLink },
    footnote: IGNORE,
  });
}

export function welcomeEmail(params: { platformName: string; loginLink: string }): RenderedEmail {
  return render({
    subject: `Welcome to ${params.platformName}`,
    title: `Welcome to ${params.platformName}`,
    preheader: 'Your account is ready to use.',
    paragraphs: [
      `Your account is ready. You can now sign in to *${params.platformName}* with the email address you registered.`,
      'Your Vyntrise account is shared across every platform you join, so the same sign-in works everywhere.',
    ],
    action: { label: 'Sign in', url: params.loginLink },
  });
}

export function passwordChangedEmail(otherDevicesSignedOut: number): RenderedEmail {
  return render({
    subject: 'Your Vyntrise password was changed',
    title: 'Password changed',
    preheader: 'The password on your account was just updated.',
    paragraphs: [
      'The password on your Vyntrise account was just changed.',
      otherDevicesSignedOut > 0
        ? `For your security, ${otherDevicesSignedOut} other ${otherDevicesSignedOut === 1 ? 'device was' : 'devices were'} signed out.`
        : 'No other devices were signed in at the time.',
    ],
    footnote: SECURE_ACCOUNT,
  });
}

export function roleChangedEmail(params: { platformName: string; role: string }): RenderedEmail {
  const promoted = params.role === 'ADMIN';
  return render({
    subject: `Your role on ${params.platformName} changed`,
    title: 'Your access level changed',
    preheader: `You are now ${promoted ? 'an administrator' : 'a member'} of ${params.platformName}.`,
    paragraphs: [
      `Your role on *${params.platformName}* is now *${params.role}*.`,
      promoted
        ? 'You can now manage members, invitations, and settings for this platform.'
        : 'You no longer have administrator access to this platform.',
    ],
    footnote: CONTACT_ADMIN,
  });
}

export function removedFromPlatformEmail(platformName: string): RenderedEmail {
  return render({
    subject: `You no longer have access to ${platformName}`,
    title: 'Access removed',
    preheader: `Your access to ${platformName} has been removed.`,
    paragraphs: [
      `Your access to *${platformName}* has been removed by an administrator.`,
      'Your Vyntrise account itself is unchanged, along with any other platforms you belong to.',
    ],
    footnote: CONTACT_ADMIN,
  });
}

export function sessionsRevokedEmail(count: number): RenderedEmail {
  return render({
    subject: 'You signed out of your other devices',
    title: 'Signed out everywhere else',
    preheader: `${count} other ${count === 1 ? 'session was' : 'sessions were'} ended.`,
    paragraphs: [
      `${count} other ${count === 1 ? 'session was' : 'sessions were'} signed out of your Vyntrise account. The device you used to make the request is still signed in.`,
    ],
    footnote: SECURE_ACCOUNT,
  });
}
