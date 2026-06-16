# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install deps (production only)
RUN npm install --omit=dev

# Copy source
COPY src ./src
COPY tsconfig.json ./
COPY prisma.config.ts ./

# Compile TypeScript
RUN npm install -D typescript ts-node @types/node prisma && npx prisma generate && npx tsc --skipLibCheck

# ── Stage 2: Production ─────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma.config.ts ./

# Run Prisma migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

EXPOSE 3021
