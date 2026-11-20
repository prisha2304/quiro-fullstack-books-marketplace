# BookNest Marketplace — Production Deployment Guide

## 1. Prerequisites
- **Node.js**: v22.x or v20 LTS
- **Database**: MySQL 8.0+ (AWS RDS, GCP Cloud SQL, or DigitalOcean Managed MySQL)
- **Cache**: Redis 7+ (AWS ElastiCache or Redis Enterprise)
- **Media Storage**: Cloudinary (or AWS S3 + CDN)
- **Payment Gateway**: Razorpay Live Merchant Account
- **Reverse Proxy**: Nginx 1.24+ with SSL certificates (Let's Encrypt / Cloudflare)

---

## 2. Environment Setup & Secret Configuration
1. Copy `.env.production.example` to `server/.env`.
2. Populate real production secrets (store in a secure secret manager like AWS Secrets Manager or HashiCorp Vault).
3. Ensure `NODE_ENV=production` is set.

---

## 3. Database Migration Deployment
Run unified, idempotent migrations:
```bash
cd server
npm run db:migrate # or: node migrate.js
```

---

## 4. Docker Deployment
```bash
# Build and run multi-container production cluster
docker compose -f docker-compose.yml up -d --build
```

---

## 5. Deployment Health Gate Verification
```bash
node scripts/deployment-health-check.js
```

---

## 6. Post-Deployment Smoke Testing
```bash
cd server
node test_production_smoke.js
```
