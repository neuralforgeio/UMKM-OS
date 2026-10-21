# UMKM OS Frontend — production image via Next.js standalone output.
#
# Stage 1 "deps": node_modules in a cacheable layer (lockfile rarely changes).
# Stage 2 "builder": compile with `next build` (emits .next/standalone).
# Stage 3 "runner": minimal runtime — no devDeps, no source, no .env;
# every runtime value arrives as a container environment variable.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
# npm ci reproduces the exact dependency tree from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

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
