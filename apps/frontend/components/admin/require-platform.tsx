'use client';

import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import { ALL_PLATFORMS, useAdminSession } from '@/app/admin/admin-session-context';
import { EmptyState, Panel } from '@/components/admin/primitives';

// Some pages act on exactly one platform (invitations, for instance). In the super-admin
// "All platforms" view they ask which one instead of guessing.
export function RequirePlatform({ children, what }: { children: (platformId: string) => ReactNode; what: string }) {
  const { scope, platforms, setScope } = useAdminSession();
  if (scope !== ALL_PLATFORMS) return <>{children(scope)}</>;

  return (
    <Panel>
      <EmptyState
        icon={Layers}
        title="Choose a platform"
        description={`${what} belong to a single platform. Pick one to continue.`}
        action={
          <div className="flex max-w-lg flex-wrap justify-center gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                onClick={() => setScope(p.id)}
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="grid h-5 w-5 place-items-center rounded bg-muted text-[10px] font-semibold uppercase">{p.name[0]}</span>
                {p.name}
              </button>
            ))}
          </div>
        }
      />
    </Panel>
  );
}
