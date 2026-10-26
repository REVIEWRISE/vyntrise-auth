import { cn } from '@/lib/utils';

// The console's mark: a gradient tile with a stylised "V". Pure SVG + CSS so it themes itself.
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-[0_0_24px_-4px_hsl(var(--accent-via)/0.6)]',
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5l8 14 8-14" />
      </svg>
    </div>
  );
}
