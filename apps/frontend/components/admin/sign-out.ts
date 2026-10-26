// Ends the server session (deleting the refresh session and cookies) as well as the local token,
// so "Sign out" from the console really signs out rather than just forgetting the token.
export async function signOut() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Offline or backend down: still clear local state below.
  }
  try {
    localStorage.removeItem('accessToken');
  } catch {
    // Storage unavailable; nothing to clear.
  }
  window.location.href = '/login';
}
