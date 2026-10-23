# =====================================================================
# UMKM OS Backend — Go REST API (chi + pgx + JWT)
#
# Stage 1 "builder": compile a STATIC binary on top of a cached module
#   layer, so a code edit only recompiles — dependencies are re-downloaded
#   solely when go.mod/go.sum change.
# Stage 2: slim runtime carrying ONLY the binary (+ curl for the
#   healthcheck). The binary embeds its own timezone database
#   (import _ "time/tzdata" in main.go), so TZ=Asia/Jakarta works without
#   installing tzdata in the image.
#
# Semua nilai runtime (DATABASE_URL, JWT_SECRET, DEVELOPER_*, ...) datang
# dari environment yang disuntikkan docker-compose — file .env TIDAK
# ikut terbawa ke dalam image (lihat .dockerignore).
# =====================================================================

# ---------------------------------------------------------------------
# Stage 1 — builder
# ---------------------------------------------------------------------
FROM golang:1.27-bookworm AS builder
WORKDIR /src

# Module layer first: `go mod download` alone is cacheable per go.mod/go.sum
# via the BuildKit cache mount, even when `docker compose up --build`
# reruns after only a .go file changed.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
# CGO_ENABLED=0 -> static binary (no libc dependency, portable runtime).
# -trimpath + -ldflags "-s -w" -> smaller binary without local paths/symbols.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/umkm-os-backend .

# ---------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------
FROM debian:bookworm-slim
WORKDIR /app

# curl      -> container healthcheck (GET /health)
# ca-certificates -> TLS root store (kalau kelak ada panggilan HTTPS keluar)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home appuser \
    && mkdir -p /app/logs \
    && chown -R appuser /app

COPY --from=builder /out/umkm-os-backend /usr/local/bin/umkm-os-backend

# Never run as root.
USER appuser

# Image-level defaults; docker-compose overrides per environment.
ENV PORT=8080 LOG_DIR=logs TZ=Asia/Jakarta

EXPOSE 8080

# Migrasi schema + seed akun berjalan SEBELUM ListenAndServe, jadi
# "healthy" berarti: server hidup DAN schema siap dipakai service lain
# (FastAPI menunggu kondisi ini saat boot pertama).
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD curl -sf http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["umkm-os-backend"]
