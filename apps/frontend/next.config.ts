import type { NextConfig } from "next";

// Rewrites are resolved when the image is built, not at runtime, so this has to be correct at
// build time. NEXT_PUBLIC_BACKEND_URL is only injected by docker-compose when the container
// runs — too late — which is why the Dockerfile sets BACKEND_INTERNAL_URL for the build stage.
// The localhost fallback is what `next dev` uses.
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3021";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker production image

  // OIDC discovery and the public key set have to live at these exact paths — every standards
  // compliant client derives them from the issuer URL and will not look anywhere else. The
  // reverse proxy sends only /api to the backend, so everything else lands here first; these
  // rewrites hand the two well-known paths straight through.
  async rewrites() {
    return [
      {
        source: "/.well-known/jwks.json",
        destination: `${BACKEND_URL}/.well-known/jwks.json`,
      },
      {
        source: "/.well-known/openid-configuration",
        destination: `${BACKEND_URL}/.well-known/openid-configuration`,
      },
    ];
  },
};

export default nextConfig;
