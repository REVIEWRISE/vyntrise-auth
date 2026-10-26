'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  // min-w-0 lets a panel shrink inside a grid track instead of widening the page on phones.
  return <section className={cn('glass min-w-0 rounded-xl', className)}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl border bg-card">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load this data.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// Change versus the previous period. `invert` flips the colouring for metrics where up is bad
// (failed sign-ins). The arrow and sign carry direction, so colour is never the only cue.
export function Delta({ change, invert, suffix = '%' }: { change: number | null | undefined; invert?: boolean; suffix?: string }) {
  if (change === undefined) return null;
  if (change === null) return <span className="text-xs font-medium text-muted-foreground">new</span>;
  const up = change > 0;
  const flat = change === 0;
  const good = flat ? null : invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular',
        good === null && 'bg-muted text-muted-foreground',
        good === true && 'bg-success/10 text-success',
        good === false && 'bg-destructive/10 text-destructive'
      )}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {change}
      {suffix}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  change,
  invert,
  changeSuffix,
  hint,
  spark,
  sparkColor = 'var(--chart-1)',
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: React.ElementType;
  change?: number | null;
  invert?: boolean;
  changeSuffix?: string;
  hint?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  loading?: boolean;
}) {
  const sparkData = spark?.map((v, i) => ({ i, v }));
  const gradientId = `spark-${label.replace(/\W/g, '')}`;
  return (
    <Panel className="group relative overflow-hidden p-5 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[1.75rem] font-semibold tracking-tight">{value}</span>
          <Delta change={change} invert={invert} suffix={changeSuffix} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {sparkData && sparkData.length > 1 && (
        <div className="pointer-events-none -mx-5 -mb-5 mt-3 h-12" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

// Destructive confirmation. With `confirmText`, the action stays disabled until that exact text
// is typed, for operations that cannot be undone.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmText,
  destructive = true,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  destructive?: boolean;
  onConfirm: () => unknown;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = confirmText !== undefined && typed !== confirmText;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        {confirmText !== undefined && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{confirmText}</span> to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Confirmation text" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={blocked || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setTyped('');
                onOpenChange(false);
              } catch {
                // The mutation already toasted the error; keep the dialog open to retry.
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: 'good' | 'warn' | 'bad' | 'neutral' | 'brand';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    good: 'border-success/25 bg-success/10 text-success',
    warn: 'border-warning/25 bg-warning/10 text-warning',
    bad: 'border-destructive/25 bg-destructive/10 text-destructive',
    neutral: 'border-border bg-muted text-muted-foreground',
    brand: 'border-primary/25 bg-primary/10 text-primary',
  } as const;
  const dots = {
    good: 'bg-success',
    warn: 'bg-warning',
    bad: 'bg-destructive',
    neutral: 'bg-muted-foreground',
    brand: 'bg-primary',
  } as const;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />
      {children}
    </span>
  );
}
