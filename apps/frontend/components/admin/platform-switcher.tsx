'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Globe, Layers } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { ALL_PLATFORMS, useAdminSession } from '@/app/admin/admin-session-context';
import { cn } from '@/lib/utils';

function PlatformGlyph({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-semibold uppercase', className)}>
      {name.slice(0, 1)}
    </span>
  );
}

export function PlatformSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { platforms, scope, setScope, isSuperAdmin, platform } = useAdminSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const label = scope === ALL_PLATFORMS ? 'All platforms' : platform?.name ?? 'Select platform';

  const choose = (next: string) => {
    setScope(next);
    setOpen(false);
    // Lists are keyed by scope already; this just drops stale data from the previous one.
    queryClient.removeQueries({ queryKey: ['admin', 'audit'] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg border bg-card/60 p-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            collapsed && 'justify-center border-transparent bg-transparent'
          )}
          aria-label={`Platform: ${label}`}
        >
          {scope === ALL_PLATFORMS ? (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-gradient text-white">
              <Layers className="h-3.5 w-3.5" />
            </span>
          ) : (
            <PlatformGlyph name={label} />
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Platform</span>
                <span className="block truncate font-medium">{label}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" side={collapsed ? 'right' : 'bottom'}>
        <Command>
          <CommandInput placeholder="Find platform…" />
          <CommandList>
            <CommandEmpty>No platform found.</CommandEmpty>
            {isSuperAdmin && (
              <>
                <CommandGroup>
                  <CommandItem value="all platforms" onSelect={() => choose(ALL_PLATFORMS)}>
                    <Layers />
                    All platforms
                    {scope === ALL_PLATFORMS && <Check className="ml-auto !text-foreground" />}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading={isSuperAdmin ? 'Every platform' : 'Your platforms'}>
              {platforms.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => choose(p.id)}>
                  <PlatformGlyph name={p.name} className="h-5 w-5 text-[10px]" />
                  <span className="truncate">{p.name}</span>
                  {scope === p.id && <Check className="ml-auto !text-foreground" />}
                </CommandItem>
              ))}
              {platforms.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" /> No platforms yet
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
