import { Request, Response } from 'express';
import { ISSUER, JWKS_PATH, DISCOVERY_PATH } from '../config/oidc';
import { getJwks } from '../services/signing-key.service';

/**
 * The public keys any consumer needs to verify a token we issued. Deliberately unauthenticated
 * and cacheable — that is the whole point: verification must not require a secret, or we are
 * back to sharing one.
 */
export async function jwks(_req: Request, res: Response): Promise<void> {
  try {
    const keySet = await getJwks();

    // Long enough that verifiers are not refetching constantly, short enough that a rotation
    // propagates within the hour. Retired keys stay in the set meanwhile, so a stale cache
    // never rejects a valid token.
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(keySet);
  } catch (error) {
    console.error('[well-known] Failed to build JWKS:', error instanceof Error ? error.message : error);
    res.status(503).json({ message: 'Signing keys are unavailable' });
  }
}

/**
 * OIDC discovery. Standard clients read this one URL and configure themselves from it.
 *
 * Only the endpoints that actually exist are advertised. Listing an authorization_endpoint
 * before it is built would make every compliant library believe it can start a login flow and
 * then fail on a 404 — an omission is far easier to diagnose than a lie.
 */
export function discovery(_req: Request, res: Response): void {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    issuer: ISSUER,
    jwks_uri: `${ISSUER}${JWKS_PATH}`,
    id_token_signing_alg_values_supported: ['RS256'],
    subject_types_supported: ['public'],
    claims_supported: ['sub', 'iss', 'exp', 'iat', 'email', 'sessionId'],
    // Advertised so the document is self-describing about what is not here yet.
    response_types_supported: [],
    grant_types_supported: [],
    service_documentation: `${ISSUER}/admin/docs`,
    _discovery_path: DISCOVERY_PATH,
  });
}
