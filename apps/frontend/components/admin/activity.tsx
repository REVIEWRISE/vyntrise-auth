import {
  Activity,
  Ban,
  CheckCircle2,
  Crown,
  Globe,
  KeyRound,
  LogIn,
  Mail,
  MailCheck,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
} from 'lucide-react';
import type { AuditEntry } from '@/lib/admin-api';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'brand';

export const ACTIVITY: Record<string, { icon: React.ElementType; tone: Tone; label: string }> = {
  PLATFORM_CREATED: { icon: Globe, tone: 'brand', label: 'Platform created' },
  PLATFORM_SETTINGS_CHANGED: { icon: Settings, tone: 'neutral', label: 'Platform settings changed' },
  PLATFORM_SECURITY_CHANGED: { icon: ShieldCheck, tone: 'warn', label: 'Platform security changed' },
  PLATFORM_DELETED: { icon: Trash2, tone: 'bad', label: 'Platform deleted' },
  INVITE_CREATED: { icon: Mail, tone: 'brand', label: 'Invite created' },
  INVITE_REVOKED: { icon: Mail, tone: 'neutral', label: 'Invite revoked' },
  INVITE_KEY_CREATED: { icon: KeyRound, tone: 'warn', label: 'Invite key issued' },
  INVITE_KEY_REVOKED: { icon: KeyRound, tone: 'neutral', label: 'Invite key revoked' },
  USER_JOINED_PLATFORM: { icon: UserPlus, tone: 'good', label: 'User joined' },
  USER_ADDED_TO_PLATFORM: { icon: UserPlus, tone: 'good', label: 'User added' },
  USER_SELF_REGISTERED: { icon: UserPlus, tone: 'good', label: 'Self-registered' },
  USER_ROLE_CHANGED: { icon: Shield, tone: 'warn', label: 'Role changed' },
  USER_REMOVED_FROM_PLATFORM: { icon: UserMinus, tone: 'neutral', label: 'User removed' },
  USER_DISABLED: { icon: UserX, tone: 'bad', label: 'Account disabled' },
  USER_ENABLED: { icon: UserCheck, tone: 'good', label: 'Account enabled' },
  USER_SESSIONS_REVOKED_BY_ADMIN: { icon: ShieldOff, tone: 'warn', label: 'Sessions revoked by admin' },
  VERIFICATION_RESENT_BY_ADMIN: { icon: MailCheck, tone: 'neutral', label: 'Verification resent' },
  EMAIL_VERIFIED: { icon: CheckCircle2, tone: 'good', label: 'Email verified' },
  LOGIN_SUCCEEDED: { icon: LogIn, tone: 'good', label: 'Signed in' },
  LOGIN_FAILED: { icon: ShieldAlert, tone: 'bad', label: 'Sign-in failed' },
  LOGIN_BLOCKED_UNVERIFIED: { icon: Ban, tone: 'warn', label: 'Sign-in blocked (unverified)' },
  LOGIN_BLOCKED_DISABLED: { icon: Ban, tone: 'bad', label: 'Sign-in blocked (disabled)' },
  LOGIN_DENIED_NO_ACCESS: { icon: Ban, tone: 'warn', label: 'Sign-in denied (no access)' },
  SESSION_REVOKED: { icon: ShieldOff, tone: 'neutral', label: 'Session revoked' },
  SUPER_ADMIN_GRANTED: { icon: Crown, tone: 'warn', label: 'Super-admin granted' },
  SUPER_ADMIN_REVOKED: { icon: Crown, tone: 'neutral', label: 'Super-admin revoked' },
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  good: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  bad: 'bg-destructive/10 text-destructive',
  brand: 'bg-primary/10 text-primary',
};

export function activityMeta(action: string) {
  return ACTIVITY[action] ?? { icon: Activity, tone: 'neutral' as Tone, label: humanize(action) };
}

export function humanize(action: string) {
  const s = action.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ActivityIcon({ action, className = 'h-8 w-8' }: { action: string; className?: string }) {
  const { icon: Icon, tone } = activityMeta(action);
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ${TONE_CLASSES[tone]} ${className}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

// One readable sentence per audit row, for feeds and the detail drawer.
export function describeActivity(log: Pick<AuditEntry, 'action' | 'actorEmail' | 'metadata'>): string {
  const actor = log.actorEmail || 'Someone';
  const meta = (log.metadata || {}) as Record<string, unknown>;
  const email = (meta.email as string) || 'a user';

  switch (log.action) {
    case 'PLATFORM_CREATED':
      return `${actor} created platform "${meta.name ?? ''}"`;
    case 'PLATFORM_DELETED':
      return `${actor} deleted platform "${meta.name ?? ''}"`;
    case 'PLATFORM_SECURITY_CHANGED':
      return `${actor} updated redirect URIs / allowed origins`;
    case 'INVITE_CREATED':
      return `${actor} invited ${email} as ${meta.role ?? 'USER'}`;
    case 'INVITE_REVOKED':
      return `${actor} revoked the invitation for ${email}`;
    case 'INVITE_KEY_CREATED':
      return `${actor} issued invite key ${meta.prefix ?? ''}…${meta.replaced ? ' (rotated)' : ''}`;
    case 'INVITE_KEY_REVOKED':
      return `${actor} revoked invite key ${meta.prefix ?? ''}…`;
    case 'USER_ROLE_CHANGED':
      return `${actor} changed ${email} from ${meta.from ?? '?'} to ${meta.to ?? '?'}`;
    case 'USER_REMOVED_FROM_PLATFORM':
      return `${actor} removed ${email} from the platform`;
    case 'USER_JOINED_PLATFORM':
      return `${meta.email ?? actor} joined the platform`;
    case 'USER_ADDED_TO_PLATFORM':
      return meta.origin === 'api'
        ? `${email} was added via the invite API`
        : `${actor} added ${email} as ${meta.role ?? 'USER'}`;
    case 'USER_SELF_REGISTERED':
      return `${meta.email ?? actor} signed up via self-registration`;
    case 'PLATFORM_SETTINGS_CHANGED':
      return meta.setting === 'profile'
        ? `${actor} updated the platform profile`
        : `${actor} turned ${meta.setting ?? 'a setting'} ${meta.to ? 'on' : 'off'}`;
    case 'USER_DISABLED':
      return `${actor} disabled ${email}${meta.reason ? ` — “${meta.reason}”` : ''}`;
    case 'USER_ENABLED':
      return `${actor} re-enabled ${email}`;
    case 'USER_SESSIONS_REVOKED_BY_ADMIN':
      return `${actor} signed ${email} out of ${meta.count ?? 'their'} session${meta.count === 1 ? '' : 's'}`;
    case 'VERIFICATION_RESENT_BY_ADMIN':
      return `${actor} resent the verification email to ${email}`;
    case 'EMAIL_VERIFIED':
      return `${meta.email ?? actor} confirmed their email`;
    case 'SESSION_REVOKED':
      return `${actor} revoked a session`;
    case 'LOGIN_SUCCEEDED':
      return `${meta.email ?? actor} signed in`;
    case 'LOGIN_FAILED':
      return `Failed sign-in for ${meta.email || 'an unknown address'}`;
    case 'LOGIN_BLOCKED_UNVERIFIED':
      return `${email} tried to sign in before confirming their email`;
    case 'LOGIN_BLOCKED_DISABLED':
      return `Disabled account ${email} tried to sign in`;
    case 'LOGIN_DENIED_NO_ACCESS':
      return `${email} tried to sign in without access to this platform`;
    case 'SUPER_ADMIN_GRANTED':
      return `${email} was made a super-admin`;
    case 'SUPER_ADMIN_REVOKED':
      return `${email} is no longer a super-admin`;
    default:
      return `${actor} · ${humanize(log.action)}`;
  }
}
