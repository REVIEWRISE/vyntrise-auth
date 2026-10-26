'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { Layers, LogOut, Mail, Monitor, Moon, Plus, Sun, User } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { ALL_PLATFORMS, useAdminSession } from '@/app/admin/admin-session-context';
import { ALL_NAV_ITEMS } from '@/components/admin/nav';
import { Avatar } from '@/components/admin/format';
import { Kbd } from '@/components/admin/primitives';
import { apiJson, qs } from '@/lib/api';
import type { Paged, UserRow } from '@/lib/admin-api';
import { signOut } from '@/components/admin/sign-out';
import { useDebounced } from '@/lib/use-debounced';

const PaletteContext = createContext<{ open: () => void } | null>(null);

export function useCommandPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { isSuperAdmin, platforms, scope, setScope } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const pendingG = useRef<number | null>(null);

  // ⌘K / Ctrl+K toggles the palette; "g" then a letter jumps to a section (Linear-style).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const item = ALL_NAV_ITEMS.find((i) => i.shortcut === e.key.toLowerCase() && (!i.superAdminOnly || isSuperAdmin));
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (e.key === 'g') {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 900);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, isSuperAdmin]);

  const term = useDebounced(search.trim(), 200);
  const userScope = isSuperAdmin ? ALL_PLATFORMS : scope;
  const { data: userHits, isFetching } = useQuery({
    queryKey: ['admin', 'palette-users', userScope, term],
    queryFn: () =>
      userScope === ALL_PLATFORMS
        ? apiJson<Paged<UserRow>>(`/api/admin/users/all${qs({ q: term, pageSize: 6 })}`)
        : apiJson<Paged<UserRow>>(`/api/admin/users${qs({ platformId: userScope, q: term, pageSize: 6 })}`),
    enabled: open && term.length >= 2,
    staleTime: 10_000,
  });

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    setSearch('');
    fn();
  }, []);

  return (
    <PaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch('');
        }}
      >
        <DialogContent hideClose className="top-[18%] max-w-xl translate-y-0 overflow-hidden p-0 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command loop>
            <CommandInput placeholder="Search pages, users, platforms, actions…" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isFetching ? 'Searching…' : 'No results.'}</CommandEmpty>

              {userHits && userHits.items.length > 0 && (
                <CommandGroup heading="Users">
                  {userHits.items.map((u) => (
                    <CommandItem key={u.id} value={`user ${u.email} ${term}`} onSelect={() => run(() => router.push(`/admin/users/${u.id}`))}>
                      <Avatar email={u.email} className="h-5 w-5 text-[9px]" />
                      <span className="truncate">{u.email}</span>
                      {u.disabledAt && <span className="text-xs text-destructive">disabled</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="Navigate">
                {ALL_NAV_ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin).map((item) => (
                  <CommandItem key={item.href} value={`go ${item.label}`} onSelect={() => run(() => router.push(item.href))}>
                    <item.icon />
                    {item.label}
                    <CommandShortcut className="flex gap-1">
                      <Kbd>G</Kbd>
                      <Kbd>{item.shortcut.toUpperCase()}</Kbd>
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Actions">
                <CommandItem value="invite a user" onSelect={() => run(() => router.push('/admin/invites?new=1'))}>
                  <Mail /> Invite a user
                </CommandItem>
                {isSuperAdmin && (
                  <CommandItem value="create a platform" onSelect={() => run(() => router.push('/admin/platforms?new=1'))}>
                    <Plus /> Create a platform
                  </CommandItem>
                )}
                <CommandItem value="my account" onSelect={() => run(() => router.push('/account'))}>
                  <User /> My account
                </CommandItem>
              </CommandGroup>

              {(platforms.length > 1 || isSuperAdmin) && (
                <CommandGroup heading="Switch platform">
                  {isSuperAdmin && (
                    <CommandItem value="switch all platforms" onSelect={() => run(() => setScope(ALL_PLATFORMS))}>
                      <Layers /> All platforms
                      {scope === ALL_PLATFORMS && <CommandShortcut>current</CommandShortcut>}
                    </CommandItem>
                  )}
                  {platforms.map((p) => (
                    <CommandItem key={p.id} value={`switch ${p.name}`} onSelect={() => run(() => setScope(p.id))}>
                      <span className="grid h-4 w-4 place-items-center rounded bg-muted text-[9px] font-semibold uppercase">{p.name[0]}</span>
                      {p.name}
                      {scope === p.id && <CommandShortcut>current</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />
              <CommandGroup heading="Preferences">
                <CommandItem value="theme dark" onSelect={() => run(() => setTheme('dark'))}>
                  <Moon /> Dark theme
                </CommandItem>
                <CommandItem value="theme light" onSelect={() => run(() => setTheme('light'))}>
                  <Sun /> Light theme
                </CommandItem>
                <CommandItem value="theme system" onSelect={() => run(() => setTheme('system'))}>
                  <Monitor /> System theme
                </CommandItem>
                <CommandItem value="sign out log out" onSelect={() => run(() => signOut())}>
                  <LogOut /> Sign out
                </CommandItem>
              </CommandGroup>
            </CommandList>
            <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate <Kbd>↵</Kbd> select
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>esc</Kbd> close
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </PaletteContext.Provider>
  );
}
