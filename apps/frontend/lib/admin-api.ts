'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiJson, qs, ApiError } from '@/lib/api';

// ── Types (mirror the backend's admin controllers) ───────────────────────────────────────────

export type Role = 'USER' | 'ADMIN';

export interface AdminMe {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  platforms: { id: string; name: string; role: 'ADMIN' | 'SUPER_ADMIN' }[];
}

export interface Metric {
  value: number;
  previous?: number;
  change?: number | null;
}

export interface AnalyticsSummary {
  range: RangeKey;
  trackingSince: string | null;
  members: { value: number; disabled: number };
  activeSessions: Metric;
  pendingInvites: Metric;
  logins: Metric;
  failedLogins: Metric;
  failedRate: Metric;
  activeUsers: Metric;
  newMembers: Metric;
}

export type RangeKey = '24h' | '7d' | '30d' | '90d';

// A type alias rather than an interface so it is assignable to the charts' generic row type.
export type TimeseriesPoint = {
  t: string;
  logins: number;
  failed: number;
  blocked: number;
  signups: number;
  invites: number;
};

export interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  platformId: string | null;
  platformName: string | null;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditFilters {
  action?: string[];
  actorId?: string;
  targetType?: string;
  targetId?: string;
  userId?: string;
  ip?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface UserRow {
  id: string;
  email: string;
  emailVerified: boolean;
  isSuperAdmin: boolean;
  disabledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  role?: Role;
  accessCreatedAt?: string;
  platforms?: { id: string; name: string; role: Role }[];
}

export interface Paged<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface UserDetail extends UserRow {
  emailVerifiedAt: string | null;
  disabledReason: string | null;
  disabledByEmail: string | null;
  updatedAt: string;
  sessionCount: number;
  memberships: {
    platformId: string;
    platformName: string;
    role: Role;
    joinedAt: string;
    canManage: boolean;
  }[];
}

export interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  isUsed: boolean;
  expiresAt: string;
  createdAt: string;
  platformId: string;
}

export interface PlatformSummary {
  id: string;
  name: string;
  description: string | null;
  allowSelfRegistration: boolean;
  redirectUriCount: number;
  createdAt: string;
  userCount: number;
}

export interface InviteKeyMeta {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PlatformDetail {
  id: string;
  name: string;
  description: string | null;
  allowSelfRegistration: boolean;
  redirectUris: string[];
  allowedOrigins: string[];
  createdAt: string;
  userCount: number;
  inviteKey: InviteKeyMeta | null;
}

export interface InviteKeyHistory extends InviteKeyMeta {
  revokedAt: string | null;
  createdByEmail: string | null;
}

// ── Query keys ───────────────────────────────────────────────────────────────────────────────
// Everything admin lives under ['admin'], so a platform switch or sign-out can drop it at once.

export const adminKeys = {
  all: ['admin'] as const,
  me: () => ['admin', 'me'] as const,
  summary: (scope: string, range: RangeKey) => ['admin', 'analytics', 'summary', scope, range] as const,
  timeseries: (scope: string, range: RangeKey) => ['admin', 'analytics', 'timeseries', scope, range] as const,
  top: (scope: string, kind: string, range: RangeKey) => ['admin', 'analytics', 'top', scope, kind, range] as const,
  breakdown: (range: RangeKey) => ['admin', 'analytics', 'breakdown', range] as const,
  audit: (scope: string, filters: AuditFilters) => ['admin', 'audit', scope, filters] as const,
  auditMeta: (scope: string) => ['admin', 'audit-meta', scope] as const,
  users: (scope: string, params: object) => ['admin', 'users', scope, params] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  sessions: (id: string) => ['admin', 'user', id, 'sessions'] as const,
  invites: (platformId: string) => ['admin', 'invites', platformId] as const,
  platforms: () => ['admin', 'platforms'] as const,
  platform: (id: string) => ['admin', 'platform', id] as const,
  inviteKeys: (id: string) => ['admin', 'platform', id, 'invite-keys'] as const,
  signingKeys: () => ['admin', 'system', 'signing-keys'] as const,
  superAdmins: () => ['admin', 'system', 'super-admins'] as const,
};

// 'all' is only meaningful for a super-admin; the backend treats a missing platformId the same.
export const scopeParam = (scope: string) => (scope === 'all' ? undefined : scope);

// ── Queries ──────────────────────────────────────────────────────────────────────────────────

export function useAdminMe() {
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: () => apiJson<AdminMe>('/api/admin/me'),
    staleTime: 60_000,
  });
}

export function useSummary(scope: string, range: RangeKey) {
  return useQuery({
    queryKey: adminKeys.summary(scope, range),
    queryFn: () => apiJson<AnalyticsSummary>(`/api/admin/analytics/summary${qs({ platformId: scopeParam(scope), range })}`),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useTimeseries(scope: string, range: RangeKey) {
  return useQuery({
    queryKey: adminKeys.timeseries(scope, range),
    queryFn: () =>
      apiJson<{ range: RangeKey; bucket: 'hour' | 'day'; points: TimeseriesPoint[] }>(
        `/api/admin/analytics/timeseries${qs({ platformId: scopeParam(scope), range })}`
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useTopFailures(scope: string, kind: 'failed_ips' | 'failed_emails', range: RangeKey) {
  return useQuery({
    queryKey: adminKeys.top(scope, kind, range),
    queryFn: () =>
      apiJson<{ items: { key: string; count: number; lastSeen: string }[] }>(
        `/api/admin/analytics/top${qs({ platformId: scopeParam(scope), kind, range })}`
      ),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformBreakdown(range: RangeKey, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.breakdown(range),
    queryFn: () =>
      apiJson<{ id: string; name: string; members: number; logins: number; failed: number }[]>(
        `/api/admin/analytics/platforms${qs({ range })}`
      ),
    enabled,
  });
}

export function useAuditLog(scope: string, filters: AuditFilters, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: adminKeys.audit(scope, filters),
    queryFn: ({ pageParam }) =>
      apiJson<{ items: AuditEntry[]; nextCursor: string | null }>(
        `/api/admin/audit${qs({ platformId: scopeParam(scope), ...filters, cursor: pageParam, limit: pageSize })}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useAuditMeta(scope: string) {
  return useQuery({
    queryKey: adminKeys.auditMeta(scope),
    queryFn: () =>
      apiJson<{ actions: string[]; targetTypes: string[] }>(`/api/admin/audit/meta${qs({ platformId: scopeParam(scope) })}`),
    staleTime: 5 * 60_000,
  });
}

export interface UserListParams {
  q?: string;
  role?: string;
  status?: string;
  page: number;
  pageSize: number;
}

// scope 'all' reads every account (super-admin); otherwise members of one platform.
export function useUsers(scope: string, params: UserListParams) {
  return useQuery({
    queryKey: adminKeys.users(scope, params),
    queryFn: () =>
      scope === 'all'
        ? apiJson<Paged<UserRow>>(`/api/admin/users/all${qs({ ...params, role: undefined })}`)
        : apiJson<Paged<UserRow>>(`/api/admin/users${qs({ platformId: scope, ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => apiJson<UserDetail>(`/api/admin/users/${id}`),
  });
}

export function useUserSessions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.sessions(id),
    queryFn: () => apiJson<SessionRow[]>(`/api/admin/users/${id}/sessions`),
    enabled,
  });
}

export function useInvites(platformId: string | null) {
  return useQuery({
    queryKey: adminKeys.invites(platformId ?? ''),
    queryFn: () => apiJson<Invite[]>(`/api/admin/invites${qs({ platformId: platformId ?? undefined })}`),
    enabled: !!platformId,
  });
}

export function usePlatforms() {
  return useQuery({
    queryKey: adminKeys.platforms(),
    queryFn: () => apiJson<PlatformSummary[]>('/api/admin/platforms'),
  });
}

export function usePlatform(id: string) {
  return useQuery({
    queryKey: adminKeys.platform(id),
    queryFn: () => apiJson<PlatformDetail>(`/api/admin/platforms/${id}`),
  });
}

export function useInviteKeyHistory(id: string) {
  return useQuery({
    queryKey: adminKeys.inviteKeys(id),
    queryFn: () => apiJson<InviteKeyHistory[]>(`/api/admin/platforms/${id}/invite-keys`),
  });
}

export function useSigningKeys(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.signingKeys(),
    queryFn: () =>
      apiJson<{ id: string; kid: string; algorithm: string; isActive: boolean; createdAt: string; retiredAt: string | null }[]>(
        '/api/admin/system/signing-keys'
      ),
    enabled,
  });
}

export function useSuperAdmins(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.superAdmins(),
    queryFn: () =>
      apiJson<{ id: string; email: string; disabledAt: string | null; lastLoginAt: string | null }[]>(
        '/api/admin/system/super-admins'
      ),
    enabled,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────────────────────
// One shape for every write: toast the outcome, then refresh everything admin so counts,
// lists and the audit feed all reflect it.

export function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong';
}

export function useAdminMutation<TVars, TResult = { message?: string }>(
  fn: (vars: TVars) => Promise<TResult>,
  options: { success?: string | ((result: TResult, vars: TVars) => string); silent?: boolean } = {}
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      if (!options.silent) {
        const message =
          typeof options.success === 'function'
            ? options.success(result, vars)
            : options.success ?? (result as { message?: string })?.message ?? 'Saved';
        toast.success(message);
      }
      return queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });
}
