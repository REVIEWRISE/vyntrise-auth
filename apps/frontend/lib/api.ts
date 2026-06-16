/**
 * Authenticated fetch wrapper.
 * - Attaches the stored access token as a Bearer header.
 * - On 401/403, attempts one silent token refresh then retries.
 * - If refresh fails, redirects to /login.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('accessToken');

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(input, { ...init, headers });

  if (res.status === 401 || res.status === 403) {
    // Try to refresh the access token
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry original request with new token
      const newToken = localStorage.getItem('accessToken');
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(input, { ...init, headers });
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
