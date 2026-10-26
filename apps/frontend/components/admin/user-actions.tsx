'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiJson, qs } from '@/lib/api';
import { useAdminMutation, type Role, type UserRow } from '@/lib/admin-api';
import { StatusPill } from '@/components/admin/primitives';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function UserStatus({ user }: { user: Pick<UserRow, 'disabledAt' | 'emailVerified'> }) {
  if (user.disabledAt) return <StatusPill tone="bad">Disabled</StatusPill>;
  if (!user.emailVerified) return <StatusPill tone="warn">Unverified</StatusPill>;
  return <StatusPill tone="good">Active</StatusPill>;
}

// Every write a console page can make against a user, with consistent toasts and cache refresh.
export function useUserMutations() {
  return {
    changeRole: useAdminMutation(
      ({ userId, platformId, role }: { userId: string; platformId: string; role: Role; email?: string }) =>
        apiJson(`/api/admin/users/${userId}${qs({ platformId })}`, { method: 'PATCH', body: { role } }),
      { success: (_r, v) => `${v.email ?? 'User'} is now ${v.role === 'ADMIN' ? 'an admin' : 'a member'}` }
    ),
    remove: useAdminMutation(
      ({ userId, platformId }: { userId: string; platformId: string; email?: string }) =>
        apiJson(`/api/admin/users/${userId}${qs({ platformId })}`, { method: 'DELETE' }),
      { success: (_r, v) => `${v.email ?? 'User'} was removed from the platform` }
    ),
    resendVerification: useAdminMutation((userId: string) =>
      apiJson(`/api/admin/users/${userId}/resend-verification`, { method: 'POST' })
    ),
    disable: useAdminMutation(({ userId, reason }: { userId: string; reason: string }) =>
      apiJson(`/api/admin/users/${userId}/disable`, { method: 'POST', body: { reason } })
    ),
    enable: useAdminMutation((userId: string) => apiJson(`/api/admin/users/${userId}/enable`, { method: 'POST' })),
    revokeSessions: useAdminMutation(({ userId, sessionId }: { userId: string; sessionId?: string }) =>
      apiJson(`/api/admin/users/${userId}/sessions${sessionId ? `/${sessionId}` : ''}`, { method: 'DELETE' })
    ),
  };
}

// Disabling asks for a reason: it is shown on the user's profile and kept in the audit trail.
export function DisableUserDialog({
  open,
  onOpenChange,
  email,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  email: string;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable {email}?</DialogTitle>
          <DialogDescription>
            They are signed out of every device immediately and cannot sign in to any platform until re-enabled. Their memberships are kept.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="disable-reason">Reason (visible to admins)</Label>
          <Textarea
            id="disable-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Left the company, suspected compromise…"
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason);
                setReason('');
                onOpenChange(false);
              } catch {
                // Toasted by the mutation.
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Disable account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
