'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  ChevronRight,
  Crown,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminSession } from '@/app/admin/admin-session-context';
import { BrandMark } from '@/components/admin/brand';
import { Avatar } from '@/components/admin/format';
import { Kbd } from '@/components/admin/primitives';
import { NAV_GROUPS, SEGMENT_LABELS, isActive } from '@/components/admin/nav';
import { PlatformSwitcher } from '@/components/admin/platform-switcher';
import { CommandPaletteProvider, useCommandPalette } from '@/components/admin/command-palette';
import { signOut } from '@/components/admin/sign-out';
import { cn } from '@/lib/utils';

const COLLAPSE_KEY = 'adminSidebarCollapsed';

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAdminSession();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2" aria-label="Console">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.superAdminOnly || isSuperAdmin);
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                      active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      collapsed && 'justify-center px-0'
                    )}
                  >
                    {active && <span className="absolute -left-3 top-1.5 h-5 w-[3px] rounded-r-full bg-brand-gradient" aria-hidden />}
                    <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.superAdminOnly && <Crown className="ml-auto h-3 w-3 text-warning" />}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/admin" className={cn('flex items-center gap-2.5 px-4 pb-3 pt-4', collapsed && 'justify-center px-0')}>
      <BrandMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Vyntrise</div>
          <div className="text-[11px] text-muted-foreground">Auth Console</div>
        </div>
      )}
    </Link>
  );
}

function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
      <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4 text-muted-foreground" />Dark</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4 text-muted-foreground" />Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system"><Monitor className="mr-2 h-4 w-4 text-muted-foreground" />System</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resolvedTheme is only known after mount
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme === 'dark';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label="Toggle theme">
          {dark ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? 'Light theme' : 'Dark theme'}</TooltipContent>
    </Tooltip>
  );
}

function UserMenu() {
  const { me, isSuperAdmin } = useAdminSession();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <Avatar email={me.email} className="h-8 w-8" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium text-foreground">{me.email}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs">
            {isSuperAdmin ? (
              <><Crown className="h-3 w-3 text-warning" /> Super-admin</>
            ) : (
              'Platform admin'
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account"><User /> My account</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <ol className="flex min-w-0 items-center gap-1.5 text-sm">
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const last = i === segments.length - 1;
        // Ids (uuids) are shortened; the page header names the entity properly.
        const label = SEGMENT_LABELS[seg] ?? (seg.length > 20 ? `${seg.slice(0, 8)}…` : seg);
        return (
          <Fragment key={href}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
            <li className={cn('truncate', last ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {last ? <span aria-current="page">{label}</span> : <Link href={href} className="hover:text-foreground">{label}</Link>}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function SearchButton() {
  const { open } = useCommandPalette();
  return (
    <button
      onClick={open}
      className="hidden h-8 w-64 items-center gap-2 rounded-md border bg-card/60 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search or jump to…</span>
      <Kbd>Ctrl K</Kbd>
    </button>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { open } = useCommandPalette();
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur-xl sm:px-6">
      <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu />
      </Button>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <Breadcrumbs />
      </nav>
      <SearchButton />
      <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={open} aria-label="Search">
        <Search />
      </Button>
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // Not persisted; fine.
      }
      return !c;
    });
  };

  return (
    <CommandPaletteProvider>
      <div className="ambient flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar/80 backdrop-blur-xl transition-[width] duration-200 lg:flex',
            collapsed ? 'w-[64px]' : 'w-[248px]'
          )}
        >
          <SidebarBrand collapsed={collapsed} />
          <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
            <PlatformSwitcher collapsed={collapsed} />
          </div>
          <SidebarNav collapsed={collapsed} />
          <div className={cn('border-t p-3', collapsed && 'px-2')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              className={cn('w-full justify-start gap-2.5 text-muted-foreground', collapsed && 'justify-center px-0')}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /> Collapse</>}
            </Button>
          </div>
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-[280px] flex-col bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBrand collapsed={false} />
            <div className="px-3 pb-3">
              <PlatformSwitcher />
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* Keyed on the path so each page gets a short entrance. */}
            <div key={pathname} className="mx-auto max-w-7xl animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
