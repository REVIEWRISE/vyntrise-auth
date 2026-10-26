'use client';

import { format, formatDistanceToNowStrict } from 'date-fns';
import { Globe, Laptop, Monitor, Smartphone, Terminal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function formatDateTime(value: string | Date) {
  return format(new Date(value), 'MMM d, yyyy · HH:mm:ss');
}

export function formatDate(value: string | Date) {
  return format(new Date(value), 'MMM d, yyyy');
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

// "3m ago", with the exact time on hover.
export function RelativeTime({ value, className }: { value: string | Date | null | undefined; className?: string }) {
  if (!value) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const date = new Date(value);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={date.toISOString()} className={cn('whitespace-nowrap', className)}>
          {formatDistanceToNowStrict(date, { addSuffix: true })}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(date)}</TooltipContent>
    </Tooltip>
  );
}

// A small, dependency-free user-agent reading: good enough to tell "Chrome on macOS" from
// "curl", which is all an admin needs at a glance. The raw string is on hover.
export function parseUserAgent(ua: string | null | undefined) {
  if (!ua) return { browser: 'Unknown', os: '', kind: 'unknown' as const };
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /curl\//i.test(ua) ? 'curl'
    : /node|undici|axios|python|go-http/i.test(ua) ? 'API client'
    : 'Unknown';
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  const kind =
    browser === 'curl' || browser === 'API client' ? ('cli' as const)
    : /iPhone|Android.*Mobile/.test(ua) ? ('mobile' as const)
    : /iPad|Android/.test(ua) ? ('tablet' as const)
    : ('desktop' as const);
  return { browser, os, kind };
}

export function UserAgentLabel({ ua, className }: { ua: string | null | undefined; className?: string }) {
  const { browser, os, kind } = parseUserAgent(ua);
  const Icon = kind === 'mobile' ? Smartphone : kind === 'tablet' ? Laptop : kind === 'cli' ? Terminal : kind === 'desktop' ? Monitor : Globe;
  const label = os ? `${browser} on ${os}` : browser;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-2', className)}>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all font-mono text-[11px]">{ua || 'No user agent recorded'}</TooltipContent>
    </Tooltip>
  );
}

// Initials avatar with a hue derived from the email, so the same person always gets the same tile.
export function Avatar({ email, className }: { email: string; className?: string }) {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <div
      className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white', className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 42%))` }}
      aria-hidden
    >
      {initials || '?'}
    </div>
  );
}
