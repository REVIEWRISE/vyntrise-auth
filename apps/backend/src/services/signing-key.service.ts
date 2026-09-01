import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';
import { ISSUER, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from '../config/oidc';

// ── Why this exists ──────────────────────────────────────────────────────────────────────
// Tokens used to be signed with JWT_SECRET, a symmetric key: the same value that verifies a
// token can also mint one. Any product handed that secret so it could check logins could also
// forge an admin token for every other product. Asymmetric signing splits those powers — the
// private key never leaves this service, and consumers get a public key that only verifies.
//
// Both algorithms are accepted while old tokens are still in circulation. Refresh tokens live
// seven days, so the HS256 fallback below can be deleted any time after a week post-deploy.

export type TokenType = 'access' | 'refresh';

export interface TokenClaims {
  id: string;
  email: string;
  sessionId?: string;
}

interface LoadedKey {
  kid: string;
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  publicJwk: JsonWebKey;
}

// A single Postgres advisory lock id, so two containers booting at once cannot each generate a
// key and leave the service with two "active" ones. Arbitrary, but it must stay stable.
const KEYGEN_LOCK_ID = 7761001;

// Keys are re-read periodically rather than cached forever, so a key added by another instance
// (or by a rotation) becomes usable without a restart.
const CACHE_TTL_MS = 5 * 60 * 1000;

let activeCache: { key: LoadedKey; at: number } | null = null;
let verifyCache: { keys: Map<string, LoadedKey>; at: number } | null = null;

// ── Private key encryption at rest ───────────────────────────────────────────────────────
// The point of asymmetric signing is that the private key is uniquely held. A database dump
// that hands it over defeats that, so it is encrypted whenever SIGNING_KEY_SECRET is present.
// Absent, it is stored as a plain PEM and boot warns loudly — degrading rather than refusing
// to start, so a missing variable never turns into an outage.

const ENC_PREFIX = 'enc.v1.';

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.scryptSync(secret, salt, 32);
}

function encryptPem(pem: string): string {
  const secret = process.env.SIGNING_KEY_SECRET?.trim();
  if (!secret) return pem;

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(pem, 'utf8'), cipher.final()]);

  const parts = [salt, iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url'));
  return ENC_PREFIX + parts.join('.');
}

function decryptPem(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const secret = process.env.SIGNING_KEY_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'Signing key is encrypted but SIGNING_KEY_SECRET is not set. Restore the variable — ' +
        'without it every token this key signed becomes unverifiable.'
    );
  }

  const [saltPart, ivPart, tagPart, dataPart] = stored.slice(ENC_PREFIX.length).split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret, Buffer.from(saltPart, 'base64url')),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}

// ── Key material ─────────────────────────────────────────────────────────────────────────

function loadFromRow(row: { kid: string; privateKeyPem: string; publicJwk: unknown }): LoadedKey {
  const privateKey = crypto.createPrivateKey(decryptPem(row.privateKeyPem));
  const publicJwk = row.publicJwk as JsonWebKey;
  const publicKey = crypto.createPublicKey({ key: publicJwk, format: 'jwk' });
  return { kid: row.kid, privateKey, publicKey, publicJwk };
}

function generateKeyPair(): { kid: string; privateKeyPem: string; publicJwk: JsonWebKey } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey;

  // The kid is derived from the key itself (an RFC 7638 style thumbprint) rather than random,
  // so the same public key always presents the same id however often it is loaded.
  const thumbprint = JSON.stringify({ e: publicJwk.e, kty: publicJwk.kty, n: publicJwk.n });
  const kid = crypto.createHash('sha256').update(thumbprint).digest('base64url');

  return {
    kid,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicJwk,
  };
}

export async function getActiveKey(): Promise<LoadedKey> {
  if (activeCache && Date.now() - activeCache.at < CACHE_TTL_MS) return activeCache.key;

  const existing = await prisma.signingKey.findFirst({
    where: { isActive: true, retiredAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const key = loadFromRow(existing);
    activeCache = { key, at: Date.now() };
    return key;
  }

  // First boot against this database. The advisory lock makes check-then-create atomic across
  // processes; whichever instance loses the race finds the winner's key on the second read.
  const row = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KEYGEN_LOCK_ID})`;

    const raced = await tx.signingKey.findFirst({ where: { isActive: true, retiredAt: null } });
    if (raced) return raced;

    const generated = generateKeyPair();
    console.log(`[signing-key] No active key found — generating one (kid=${generated.kid})`);

    return tx.signingKey.create({
      data: {
        kid: generated.kid,
        algorithm: 'RS256',
        publicJwk: generated.publicJwk as never,
        privateKeyPem: encryptPem(generated.privateKeyPem),
        isActive: true,
      },
    });
  });

  const key = loadFromRow(row);
  activeCache = { key, at: Date.now() };
  return key;
}

async function getVerificationKeys(): Promise<Map<string, LoadedKey>> {
  if (verifyCache && Date.now() - verifyCache.at < CACHE_TTL_MS) return verifyCache.keys;

  // Retired keys stay verifiable until every token they signed has expired, which is what makes
  // a rotation a non-event instead of a mass logout.
  const rows = await prisma.signingKey.findMany({ orderBy: { createdAt: 'desc' } });
  const keys = new Map<string, LoadedKey>();

  for (const row of rows) {
    try {
      keys.set(row.kid, loadFromRow(row));
    } catch (error) {
      console.error(
        `[signing-key] ⚠️ Could not load key ${row.kid}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  verifyCache = { keys, at: Date.now() };
  return keys;
}

/** Public halves only — safe to serve to anyone who asks. */
export async function getJwks(): Promise<{ keys: JsonWebKey[] }> {
  const keys = await getVerificationKeys();
  return {
    keys: [...keys.values()].map((key) => ({ ...key.publicJwk, kid: key.kid, use: 'sig', alg: 'RS256' })),
  };
}

// ── Signing and verification ─────────────────────────────────────────────────────────────

async function sign(claims: TokenClaims, typ: TokenType, expiresIn: string): Promise<string> {
  const key = await getActiveKey();

  return jwt.sign(
    // `id` is kept beside the standard `sub` because existing middleware, controllers, and any
    // already-integrated consumer read `id`. Dropping it would be a breaking change for tidiness.
    { id: claims.id, sub: claims.id, email: claims.email, sessionId: claims.sessionId, typ },
    key.privateKey,
    {
      algorithm: 'RS256',
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      keyid: key.kid,
      issuer: ISSUER,
    }
  );
}

export const signAccessToken = (claims: TokenClaims) => sign(claims, 'access', ACCESS_TOKEN_TTL);
export const signRefreshToken = (claims: TokenClaims) => sign(claims, 'refresh', REFRESH_TOKEN_TTL);

export interface VerifiedToken {
  id: string;
  email: string;
  sessionId?: string;
  legacy: boolean;
}

/**
 * Verifies a token issued by this service. Accepts current RS256 tokens and, until the last
 * pre-rotation refresh token expires, the previous HS256 ones.
 *
 * Throws on anything invalid, matching `jwt.verify` so existing try/catch sites still work.
 */
export async function verifyToken(token: string, expected: TokenType): Promise<VerifiedToken> {
  const decoded = jwt.decode(token, { complete: true });

  if (decoded && typeof decoded !== 'string' && decoded.header.alg === 'RS256') {
    const kid = decoded.header.kid;
    if (!kid) throw new jwt.JsonWebTokenError('Token is missing a key id');

    const keys = await getVerificationKeys();
    const key = keys.get(kid);
    if (!key) throw new jwt.JsonWebTokenError(`Unknown signing key: ${kid}`);

    const payload = jwt.verify(token, key.publicKey, {
      algorithms: ['RS256'],
      issuer: ISSUER,
    }) as jwt.JwtPayload;

    // Without this an access token could be replayed as a refresh token. The two separate
    // HS256 secrets used to enforce that distinction, and one key pair now signs both.
    if (payload.typ !== expected) {
      throw new jwt.JsonWebTokenError(`Expected a ${expected} token but received ${String(payload.typ)}`);
    }

    return {
      id: payload.id as string,
      email: payload.email as string,
      sessionId: payload.sessionId as string | undefined,
      legacy: false,
    };
  }

  // Legacy HS256 path. `algorithms` is pinned so a token cannot talk us into a weaker check.
  const secret = expected === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  const payload = jwt.verify(token, secret as string, { algorithms: ['HS256'] }) as jwt.JwtPayload;

  return {
    id: payload.id as string,
    email: payload.email as string,
    sessionId: payload.sessionId as string | undefined,
    legacy: true,
  };
}

/** Boot-time report, mirroring how email configuration announces itself. */
export async function reportSigningKeys(): Promise<void> {
  try {
    const key = await getActiveKey();
    const encrypted = Boolean(process.env.SIGNING_KEY_SECRET?.trim());

    if (!encrypted) {
      console.warn(
        '[signing-key] ⚠️ SIGNING_KEY_SECRET is not set — the private signing key is stored ' +
          'unencrypted. Anyone who can read the database can mint tokens for any user.'
      );
    }

    console.log(`[signing-key] alg=RS256 kid=${key.kid} encrypted=${encrypted} issuer=${ISSUER}`);
  } catch (error) {
    // Never fatal: the HS256 fallback keeps sign-in working while the cause is investigated.
    console.error(
      '[signing-key] ❌ Could not load or create a signing key:',
      error instanceof Error ? error.message : error
    );
    console.error('[signing-key] Tokens will continue to be verified with the legacy shared secret.');
  }
}
