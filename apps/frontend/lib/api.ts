/**
 * Authenticated fetch wrapper.
 * - Attaches the stored access token as a Bearer header.
 * - On 401/403, attempts one silent token refresh then retries.
 * - If refresh fails or session is revoked, redirects to /login.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('accessToken');

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401 || res.status === 403) {
    // Check if it's a session revoked error
    const errorData = await res.clone().json().catch(() => ({}));
    if (errorData.message?.includes('revoked')) {
      // Session was revoked - clear everything and redirect immediately
      localStorage.removeItem('accessToken');
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      window.location.href = '/login?message=session-revoked';
      return res;
    }

    // Try to refresh the access token
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry original request with new token
      const newToken = localStorage.getItem('accessToken');
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(input, { ...init, headers, credentials: 'include' });
    } else {
      // Refresh failed — clear token and redirect
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
  }

  return res;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
