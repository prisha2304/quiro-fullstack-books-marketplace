# Multi-stage production Dockerfile for BookNest Server
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl python3 make g++

FROM base AS dependencies
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5000
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# ── Non-root user ────────────────────────────────────────────────────────────
# Create a dedicated system group and user (no password, no login shell).
# -S = system account  -G = assign primary group  -H = no home dir needed
#   (we set HOME explicitly via ENV below)
RUN addgroup -S quiro \
 && adduser -S -G quiro -H -h /app quiro \
 # /app itself: owned by quiro so Tesseract.js can write eng.traineddata there.
 # Files inside /app keep root:root ownership (644/755 — readable by any user).
 && chown quiro:quiro /app \
 # Pre-create runtime write directories with correct ownership.
 && mkdir -p /app/public/uploads /app/uploads/invoices \
 && chown -R quiro:quiro /app/public/uploads /app/uploads/invoices

# HOME must be set so that any tool defaulting to ~ has a known writable path.
ENV HOME=/app
USER quiro
# ─────────────────────────────────────────────────────────────────────────────

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health/live || exit 1

CMD ["node", "index.js"]
