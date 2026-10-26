# =====================================================================
# UMKM OS Backend — two-stage build
# Stage 1 "deps": install Python packages in an isolated layer
# Stage 2: slim runtime image that only carries installed packages + code
# Result: small image and fast rebuilds (requirements.txt rarely changes)
# =====================================================================

# ---------------------------------------------------------------------
# Stage 1 — dependencies
# ---------------------------------------------------------------------
FROM python:3.12.3-slim AS deps

WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------
FROM python:3.12.3-slim

WORKDIR /app

# Copy installed packages from stage 1 (no build tools shipped)
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Application code (see .dockerignore for what is excluded)
COPY . .

# Run as an unprivileged user — never run containers as root
RUN useradd --create-home appuser && mkdir -p /app/mlmodels && chown -R appuser /app
USER appuser

# Image-level defaults; override per environment (compose / production)
ENV HOST=0.0.0.0 PORT=8000 DEBUG=false

EXPOSE 8000

# run.py reads HOST / PORT / DEBUG from the environment
CMD ["python", "run.py"]
