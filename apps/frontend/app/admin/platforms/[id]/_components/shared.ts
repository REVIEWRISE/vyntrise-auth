'use client';

import { apiJson } from '@/lib/api';
import { useAdminMutation, type PlatformDetail } from '@/lib/admin-api';

export const AUTH_BASE = 'https://auth.vyntrise.com';

export type PlatformPatch = Partial<
  Pick<PlatformDetail, 'name' | 'description' | 'allowSelfRegistration' | 'redirectUris' | 'allowedOrigins'>
>;

export function usePlatformUpdate(id: string) {
  return useAdminMutation(
    (patch: PlatformPatch) => apiJson<PlatformDetail>(`/api/admin/platforms/${id}`, { method: 'PATCH', body: patch }),
    { success: 'Platform updated' }
  );
}
