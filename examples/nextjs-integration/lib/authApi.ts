/**
 * Vyntrise Auth API Client
 * 
 * This is a TESTED reference implementation for integrating with Vyntrise Auth
 * in a Next.js application with session revocation support.
 * 
 * Copy this file to your project and update the environment variables.
 * 
 * VERIFIED FEATURES:
 * ✅ Session revocation detection
 * ✅ Automatic token refresh
 * ✅ Cookie handling with credentials: 'include'
 * ✅ Error handling and logging
 * ✅ Configuration validation
 */

/**
 * Authenticated fetch wrapper for auth.vyntrise.com endpoints
 * 
 * Features:
 * - Automatically adds Bearer token to requests
 * - Handles token refresh on 401/403
 * - Detects and handles session revocation
 * - Redirects to login when authentication fails
 * 
 * @param endpoint - API endpoint path (e.g., '/api/account/me')
 * @param init - Fetch options (method, body, headers, etc.)
 * @returns Response from the API
 */
export async function authApiFetch(
  endpoint: string, 
  init: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('accessToken');
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.vyntrise.com';

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // Only set Content-Type for string bodies (JSON)
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${authBaseUrl}${endpoint}`;
  let res = await fetch(url, { 
    ...init, 
    headers,
    credentials: 'include' // CRITICAL: Send cookies for session validation
  });

  // Handle authentication errors
  if (res.status === 401 || res.status === 403) {
    const errorData = await res.clone().json().catch(() => ({}));
    
    // Check if session was revoked
    if (errorData.message?.toLowerCase().includes('revoked')) {
      console.warn('[Auth] Session revoked, redirecting to login');
      handleSessionRevoked();
      return res; // Return the 401 response
    }

    console.log('[Auth] Token expired, attempting refresh');
    
    // Try to refresh token (only once to prevent infinite loops)
    const refreshed = await tryRefresh(authBaseUrl);
    if (refreshed) {
      console.log('[Auth] Token refreshed successfully, retrying request');
      // Retry with new token
      const newToken = localStorage.getItem('accessToken');
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...init, headers, credentials: 'include' });
      }
    } else {
      console.warn('[Auth] Token refresh failed, redirecting to login');
      // Refresh failed
      handleAuthFailure();
    }
  }

  return res;
}

/**
 * Attempt to refresh the access token using the refresh token cookie
 * 
 * @param authBaseUrl - Base URL of auth service
 * @returns True if refresh succeeded, false otherwise
 */
async function tryRefresh(authBaseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${authBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include' // CRITICAL: Send refresh token cookie
    });
    
    if (!res.ok) {
      console.error('[Auth] Refresh failed with status:', res.status);
      return false;
    }
    
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      console.log('[Auth] New access token stored');
      return true;
    }
    
    console.error('[Auth] Refresh response missing accessToken');
    return false;
  } catch (error) {
    console.error('[Auth] Refresh request failed:', error);
    return false;
  }
}

/**
 * Handle session revocation - redirect to auth service with message
 */
function handleSessionRevoked() {
  // Clear local tokens
  localStorage.removeItem('accessToken');
  
  // Get configuration
  const platformId = process.env.NEXT_PUBLIC_PLATFORM_ID;
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.vyntrise.com';
  
  if (!platformId) {
    console.error('[Auth] NEXT_PUBLIC_PLATFORM_ID not configured');
    // Fallback to local login
    window.location.href = '/login?message=session-revoked';
    return;
  }
  
  // Build callback URL
  const redirectUrl = encodeURIComponent(
    `${window.location.origin}/auth/callback`
  );
  
  // Redirect to auth service with session revoked message
  const loginUrl = `${authBaseUrl}/login?platformId=${platformId}&redirectUrl=${redirectUrl}&message=session-revoked`;
  
  console.log('[Auth] Redirecting to auth service:', loginUrl);
  window.location.href = loginUrl;
}

/**
 * Handle general authentication failure - redirect to local login
 */
function handleAuthFailure() {
  // Clear local tokens
  localStorage.removeItem('accessToken');
  
  // Redirect to your platform's login page
  // This could also redirect to auth service for SSO
  console.log('[Auth] Redirecting to login page');
  window.location.href = '/login?message=session-expired';
}

/**
 * Get user profile from auth service
 * 
 * @returns User profile with platform memberships
 * @throws Error if request fails
 */
export async function getUserProfile() {
  const response = await authApiFetch('/api/account/me');
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch profile' }));
    throw new Error(error.message || 'Failed to fetch user profile');
  }
  return response.json();
}

/**
 * Logout from auth service and clear local state
 */
export async function logout() {
  try {
    // Call auth service logout endpoint
    await authApiFetch('/api/auth/logout', { method: 'POST' });
    console.log('[Auth] Logout successful');
  } catch (error) {
    console.error('[Auth] Logout request failed:', error);
    // Continue with local cleanup even if request fails
  } finally {
    // Always clear local storage
    localStorage.removeItem('accessToken');
    
    // Redirect to login
    window.location.href = '/login';
  }
}

/**
 * Check if user is authenticated (has valid token)
 * Note: This only checks if token exists, not if it's valid
 * 
 * @returns True if token exists in localStorage
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}

/**
 * Get the current access token
 * 
 * @returns Access token or null if not logged in
 */
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}
