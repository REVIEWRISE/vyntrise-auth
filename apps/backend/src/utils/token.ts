import crypto from 'crypto';

// Reset and invite tokens are 256 bits of CSPRNG output, so they need no salt and no work
// factor — an attacker cannot enumerate the keyspace regardless of hash speed. SHA-256 gives
// the property that actually matters here: a database read (backup, dump, injection elsewhere)
// yields digests rather than working tokens. bcrypt would only add cost, and its per-row salt
// would rule out the indexed lookup these tokens depend on.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
