# =====================================================================
# UMKM OS Backend — Go REST API (chi + pgx + JWT) — ERA GO MURNI
#
# Stage 1 "builder": compile dua STATIC binary di atas layer module
#   yang ter-cache:
#     - umkm-os-backend : API server (migrasi + seed saat boot)
#     - umkm-selftest   : uji database (Gerbang E) + Groq LIVE ([4b])
#   `go vet` + `go test ./...` (unittest murni, tanpa DB/jaringan)
#   dijalankan DI DALAM build — image hanya selesai bila seluruh
#   unittest lolos: setiap rebuild = satu putaran gerbang pengujian.
# Stage 2: slim runtime membawa HANYA kedua binary (+ curl untuk
#   healthcheck). Binary menanam data zona waktunya sendiri
#   (import _ "time/tzdata" di main.go), jadi TZ=Asia/Jakarta bekerja
#   tanpa tzdata di image.
#
# Semua nilai runtime (DATABASE_URL, JWT_SECRET, LLM_*, ...) datang
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
#
# GERBANG UJI DALAM BUILD (era go murni): go vet + seluruh unittest
# harus lolos sebelum binary dihasilkan — kegagalan tes apa pun
# menggagalkan `docker compose up --build` dengan pesan jelas.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go vet ./... && go test ./...

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/umkm-os-backend . && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/umkm-selftest ./cmd/selftest

# ---------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------
FROM debian:bookworm-slim
WORKDIR /app

# curl      -> container healthcheck (GET /health)
# ca-certificates -> TLS root store (panggilan HTTPS keluar: Groq,
#                    geo lookup IP audit)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home appuser \
    && mkdir -p /app/logs /app/aidata \
    && chown -R appuser /app

COPY --from=builder /out/umkm-os-backend /usr/local/bin/umkm-os-backend
COPY --from=builder /out/umkm-selftest /usr/local/bin/umkm-selftest

# Never run as root.
USER appuser

# Image-level defaults; docker-compose overrides per environment.
ENV PORT=8080 LOG_DIR=logs AI_DATA_DIR=/app/aidata TZ=Asia/Jakarta

EXPOSE 8080

# Migrasi schema + seed akun berjalan SEBELUM ListenAndServe, jadi
# "healthy" berarti: server hidup DAN schema siap (migrasi #13 SKU
# per outlet + #14 audit ber-IP ikut berjalan saat boot).
#
# "healthcheck tenang" (permintaan pemilik: jangan selalu fetch
# /health karena memberatkan laptop): interval 60s. docker-compose.yml
# menimpa nilai ini dengan start_interval sehingga BOOT tetap cepat.
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -sf http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["umkm-os-backend"]
