# UMKM OS Frontend — production image via Next.js standalone output.
#
# Stage 1 "deps": node_modules in a cacheable layer (lockfile rarely changes).
# Stage 2 "builder": compile with `next build` (emits .next/standalone).
# Stage 3 "runner": minimal runtime — no devDeps, no source, no .env;
# every runtime value arrives as a container environment variable.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# npm ci reproduces the exact dependency tree from the lockfile.
#
# Flaky-network armor (ECONNRESET kept aborting mid-stream downloads):
# 1. The BuildKit cache mount keeps npm's tarball cache alive ACROSS
#    builds — a failed attempt no longer wastes its downloads; every
#    retry resumes from cached packages and converges to success.
# 2. A shell-level retry loop restarts the whole `npm ci` when npm's
#    own per-request retries give up (a mid-stream ECONNRESET kills
#    the entire run; flags alone cannot recover from that).
# 3. Fewer concurrent sockets and a longer fetch timeout are gentler
#    on unstable links than npm's defaults (15 parallel sockets).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    set -e; \
    ok=0; \
    for i in 1 2 3 4 5; do \
      if npm ci --fetch-retries=5 \
                --fetch-retry-mintimeout=20000 \
                --fetch-retry-maxtimeout=300000 \
                --fetch-timeout=600000 \
                --maxsockets=6 \
                --no-audit --no-fund; then \
        ok=1; \
        break; \
      fi; \
      echo ">>> npm ci failed (attempt $i/5) - sleeping 15s, retrying with warm cache"; \
      sleep 15; \
    done; \
    [ "$ok" = "1" ]

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders, overridden per environment at runtime:
#  - DATABASE_URL: every DB page is dynamic (instant = false) and the
#    pg pool connects lazily, so no real database is reachable at build.
#  - AUTH_SECRET: next-auth v5 throws MissingSecret when NODE_ENV is
#    production during prerender — a placeholder satisfies that check;
#    the real secret is injected by compose at runtime.
ARG DATABASE_URL=postgresql://placeholder:placeholder@db:5432/placeholder
ARG AUTH_SECRET=build-time-placeholder
ENV DATABASE_URL=${DATABASE_URL}
ENV AUTH_SECRET=${AUTH_SECRET}
RUN npm run build
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
PORT=3000 \
HOSTNAME=0.0.0.0
# Standalone bundle: minimal server.js + the traced node_modules subset.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Never run as root.
USER node
EXPOSE 3000
CMD ["node", "server.js"]
