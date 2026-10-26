import prisma from '../db/prisma';

// Per-platform redirect and CORS configuration. Before this existed, the login page hardcoded
// *.vyntrise.com plus localhost as the only redirect targets, and CORS came solely from the
// ALLOWED_ORIGINS env var. Both still apply as fallbacks (see below) so nothing breaks for a
// platform until an admin configures it.

export const MAX_ENTRIES = 20;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// Mirrors the frontend's former rule: a platform app in local development runs on localhost,
// usually over plain http. Allowed in development builds; in production only when explicitly
// opted in, since it hands a live token to whatever is listening on that port.
export function localhostAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCALHOST_REDIRECT === 'true';
}

// Defaults to on. Turn off (LEGACY_REDIRECT_FALLBACK=false) once every platform lists its own
// redirect URIs, so the broad *.vyntrise.com rule stops applying.
function legacyFallbackEnabled(): boolean {
  return process.env.LEGACY_REDIRECT_FALLBACK !== 'false';
}

function isLocal(url: URL): boolean {
  return LOCAL_HOSTS.has(url.hostname);
}

function schemeAllowed(url: URL): boolean {
  if (url.protocol === 'https:') return !isLocal(url) || localhostAllowed();
  if (url.protocol === 'http:') return isLocal(url) && localhostAllowed();
  return false;
}

type Normalized = { ok: true; values: string[] } | { ok: false; message: string };

// Redirect URIs are stored as origin + path, with no query, fragment, credentials or wildcard,
// so matching is a plain prefix comparison that cannot be confused by URL tricks.
export function normalizeRedirectUris(input: unknown): Normalized {
  return normalizeList(input, 'redirect URI', (raw) => {
    const url = new URL(raw);
    if (url.username || url.password) throw new Error('must not contain credentials');
    if (url.search || url.hash) throw new Error('must not contain a query string or fragment');
    return `${url.origin}${url.pathname}`;
  });
}

// Origins are exact scheme://host[:port] values, as the browser sends them in the Origin header.
export function normalizeOrigins(input: unknown): Normalized {
  return normalizeList(input, 'origin', (raw) => {
    const url = new URL(raw);
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('must be a bare origin such as https://app.example.com');
    }
    return url.origin;
  });
}

function normalizeList(input: unknown, label: string, normalize: (raw: string) => string): Normalized {
  if (!Array.isArray(input)) return { ok: false, message: `${label} list must be an array` };
  if (input.length > MAX_ENTRIES) {
    return { ok: false, message: `At most ${MAX_ENTRIES} ${label}s are allowed` };
  }

  const values: string[] = [];
  for (const entry of input) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return { ok: false, message: `Every ${label} must be a non-empty string` };
    }
    const raw = entry.trim();
    if (raw.includes('*')) return { ok: false, message: `Wildcards are not allowed: ${raw}` };

    let value: string;
    try {
      value = normalize(raw);
    } catch (error) {
      const reason = error instanceof Error && error.message !== 'Invalid URL' ? error.message : 'is not a valid absolute URL';
      return { ok: false, message: `Invalid ${label} "${raw}": ${reason}` };
    }

    const parsed = new URL(value);
    if (!schemeAllowed(parsed)) {
      return {
        ok: false,
        message: isLocal(parsed)
          ? `Localhost ${label}s are not enabled on this server: ${raw}`
          : `Only https ${label}s are allowed: ${raw}`,
      };
    }
    if (!values.includes(value)) values.push(value);
  }

  return { ok: true, values };
}

function matchesPrefix(target: URL, allowed: string): boolean {
  let prefix: URL;
  try {
    prefix = new URL(allowed);
  } catch {
    return false;
  }
  if (target.origin !== prefix.origin) return false;

  const base = prefix.pathname;
  if (base === '/' || target.pathname === base) return true;
  // Path boundary: /auth/callback must not admit /auth/callback-evil.
  const withSlash = base.endsWith('/') ? base : `${base}/`;
  return target.pathname.startsWith(withSlash);
}

function legacyAllowed(target: URL): boolean {
  const isVyntriseHost = target.protocol === 'https:'
    && (target.hostname === 'vyntrise.com' || target.hostname.endsWith('.vyntrise.com'));
  const isLocalhost = (target.protocol === 'http:' || target.protocol === 'https:') && isLocal(target);
  return isVyntriseHost || (isLocalhost && localhostAllowed());
}

// Decides whether the login page may hand a freshly issued token to `redirectUrl`. A platform
// with configured redirect URIs is held strictly to them; otherwise the legacy rule applies
// while LEGACY_REDIRECT_FALLBACK is on.
export async function isRedirectAllowed(platformId: string | null, redirectUrl: string): Promise<boolean> {
  let target: URL;
  try {
    target = new URL(redirectUrl);
  } catch {
    return false;
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false;
  if (target.username || target.password) return false;
  if (!schemeAllowed(target)) return false;
  // Never bounce a token into an error page; kept from the original client-side rule.
  if (target.pathname.includes('/error')) return false;

  if (platformId) {
    const platform = await prisma.platform
      .findUnique({ where: { id: platformId }, select: { redirectUris: true } })
      .catch(() => null);
    if (platform && platform.redirectUris.length > 0) {
      return platform.redirectUris.some((allowed) => matchesPrefix(target, allowed));
    }
  }

  return legacyFallbackEnabled() && legacyAllowed(target);
}

// ── CORS ─────────────────────────────────────────────────────────────────────────────────────
// The union of every platform's allowedOrigins, refreshed in the background. On any failure the
// previous set is kept (initially empty), so a database problem can only ever narrow CORS back
// to the ALLOWED_ORIGINS env list, never widen it.

const ORIGIN_CACHE_TTL_MS = 60 * 1000;
let platformOrigins = new Set<string>();
let loadedAt = 0;
let refreshing: Promise<void> | null = null;

async function refreshOrigins(): Promise<void> {
  try {
    const rows = await prisma.platform.findMany({ select: { allowedOrigins: true } });
    platformOrigins = new Set(rows.flatMap((r) => r.allowedOrigins));
    loadedAt = Date.now();
  } catch (error) {
    console.error('Could not refresh platform CORS origins:', error);
  }
}

export async function isPlatformOrigin(origin: string): Promise<boolean> {
  if (Date.now() - loadedAt > ORIGIN_CACHE_TTL_MS) {
    refreshing ??= refreshOrigins().finally(() => {
      refreshing = null;
    });
    // Only the first request after startup waits; later ones use the previous set while the
    // refresh runs.
    if (loadedAt === 0) await refreshing;
  }
  return platformOrigins.has(origin);
}

export function invalidateOriginCache(): void {
  loadedAt = 0;
}
