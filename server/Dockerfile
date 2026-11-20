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

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health/live || exit 1

CMD ["node", "index.js"]
