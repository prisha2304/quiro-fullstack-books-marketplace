# Multi-stage production Dockerfile for BookNest Client
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency manifests from client directory
COPY client/package*.json ./
RUN npm ci

# Copy client application source
COPY client/ ./

# Build arguments for frontend configuration
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
