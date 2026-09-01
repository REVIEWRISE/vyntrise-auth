// The public identity of this auth server. It goes into the `iss` claim of every token and is
// the value consumers pin when they configure their OIDC client, so it must match the URL
// browsers actually reach — a mismatch makes every standards-compliant library reject our
// tokens with an unhelpful "issuer invalid".
export const ISSUER = (
  process.env.OIDC_ISSUER ||
  process.env.FRONTEND_URL ||
  'http://localhost:3020'
).replace(/\/+$/, '');

export const JWKS_PATH = '/.well-known/jwks.json';
export const DISCOVERY_PATH = '/.well-known/openid-configuration';

// Access tokens stay short because revocation is checked against the session table on every
// request; refresh tokens carry the 7-day window the cookie already used.
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '7d';
