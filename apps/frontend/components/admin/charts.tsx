'use client';

import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { cn } from '@/lib/utils';

export interface Series {
  key: string;
  label: string;
  // A CSS colour, normally one of the validated --chart-N tokens.
  color: string;
}

type Point = { t: string } & Record<string, number | string>;

function tickLabel(t: string, bucket: 'hour' | 'day') {
  return format(new Date(t), bucket === 'hour' ? 'HH:mm' : 'MMM d');
}

// Legend sits above the plot and names every series; colour is never the only identifier
// because each entry also carries its total.
export function ChartLegend({ series, totals }: { series: Series[]; totals?: Record<string, number> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
          <span>{s.label}</span>
          {totals && <span className="tabular font-medium text-foreground">{new Intl.NumberFormat().format(totals[s.key] ?? 0)}</span>}
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  bucket,
}: Pick<TooltipContentProps<ValueType, NameType>, 'active' | 'payload' | 'label'> & { series: Series[]; bucket: 'hour' | 'day' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1.5 font-medium text-foreground">
        {format(new Date(String(label)), bucket === 'hour' ? 'MMM d, HH:mm' : 'EEE, MMM d')}
      </div>
      <ul className="space-y-1">
        {series.map((s) => {
          const entry = payload.find((p) => p.dataKey === s.key);
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="tabular font-medium text-foreground">{Number(entry?.value ?? 0).toLocaleString()}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const axisProps = {
  stroke: 'var(--chart-axis)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function TrendChart({
  data,
  series,
  bucket,
  kind = 'area',
  height = 260,
  className,
}: {
  data: Point[];
  series: Series[];
  bucket: 'hour' | 'day';
  kind?: 'area' | 'bar';
  height?: number;
  className?: string;
}) {
  const Chart = kind === 'area' ? AreaChart : BarChart;
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2} barCategoryGap="28%">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />
          <XAxis
            dataKey="t"
            {...axisProps}
            tickFormatter={(t) => tickLabel(t, bucket)}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis {...axisProps} allowDecimals={false} width={44} tickMargin={4} />
          <Tooltip
            cursor={kind === 'area' ? { stroke: 'var(--chart-axis)', strokeWidth: 1, strokeDasharray: '3 3' } : { fill: 'hsl(var(--muted) / 0.5)' }}
            content={({ active, payload, label }) => (
              <ChartTooltip active={active} payload={payload} label={label} series={series} bucket={bucket} />
            )}
          />
          {series.map((s) =>
            kind === 'area' ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                animationDuration={500}
              />
            ) : (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                animationDuration={500}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

// Segmented control for picking a time range; one row, above the charts it filters.
export function RangeTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-lg border bg-card/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
