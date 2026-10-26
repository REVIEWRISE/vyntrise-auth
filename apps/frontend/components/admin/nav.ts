import {
  BookOpen,
  Globe,
  LayoutDashboard,
  Mail,
  ScrollText,
  ServerCog,
  Users,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  // Two-key "g then x" shortcut, shown in the command palette.
  shortcut: string;
  superAdminOnly?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'o' }],
  },
  {
    label: 'Manage',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users, shortcut: 'u' },
      { href: '/admin/invites', label: 'Invitations', icon: Mail, shortcut: 'i' },
      { href: '/admin/platforms', label: 'Platforms', icon: Globe, shortcut: 'p' },
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, shortcut: 'a' },
      { href: '/admin/system', label: 'System', icon: ServerCog, shortcut: 's', superAdminOnly: true },
    ],
  },
  {
    label: 'Resources',
    items: [{ href: '/admin/docs', label: 'Integration docs', icon: BookOpen, shortcut: 'd' }],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

// Breadcrumb labels for path segments that are not nav items.
export const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Console',
  users: 'Users',
  invites: 'Invitations',
  platforms: 'Platforms',
  audit: 'Audit log',
  system: 'System',
  docs: 'Integration docs',
};
