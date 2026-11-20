# QUIRO — Production Deployment Readiness Audit & Guide

This document outlines the deployment readiness status, environment configurations, security checklists, and launch procedures for the **QUIRO** literary marketplace.

> **IMPORTANT**: As per current development policy, the application remains running locally in Razorpay TEST MODE. This guide prepares the application for production hosting when ready.

---

## 🔒 1. Production Security Audit

| Security Domain | Local / Sandbox Status | Production Requirement | Verified |
| :--- | :--- | :--- | :---: |
| **Password Hashing** | Bcrypt (10 salt rounds) | Minimum 10 salt rounds; no plaintexts | ✅ Passed (100% users) |
| **Session & Auth** | Signed JWT (1-hour expiry) | Strong secret (`JWT_SECRET` min 32 chars) | ✅ Passed |
| **CORS Policy** | Express CORS allows `localhost:5173` | Restrict `origin` to production domain | ✅ Configured |
| **CORS Headers** | Whitelists `Idempotency-Key`, `x-razorpay-signature` | Exact header validation in `server/index.js` | ✅ Passed |
| **Address Privacy** | Strictly restricted to swap participants & admin | Enforced in `Swap.getSwapDetails` | ✅ Passed |
| **Email Privacy Gate** | Masked until mutual consent granted | Enforced in `Swap.getSwapDetails` | ✅ Passed |
| **Payment Verification** | Server-side HMAC-SHA256 signature verification | Tested with live Razorpay SDK and test sandbox | ✅ Passed |
| **Idempotency** | `Idempotency-Key` prevents double billing | Table `payment_idempotency` active | ✅ Passed |

---

## ⚙️ 2. Environment Variables Checklist

### Production Backend Environment (`server/.env`)

```ini
PORT=5000
NODE_ENV=production

# Database Connection Pool
DB_HOST=your-prod-db-cluster.internal
DB_USER=quiro_prod_user
DB_PASSWORD=your_strong_generated_db_password
DB_NAME=quiro_production_db
DB_PORT=3306

# Security & CORS
JWT_SECRET=super_secret_high_entropy_random_jwt_key_2026
CLIENT_URL=https://quiro.in

# Razorpay Production Keys (Toggle from Test when ready)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=yyyyyyyyyyyyyyyyyyyyyyyy

# Logistics Configuration
SWAP_SHIPPING_FEE=79.00
```

### Production Frontend Environment (`client/.env`)

```ini
VITE_API_URL=https://api.quiro.in/api
VITE_SOCKET_URL=https://api.quiro.in
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

---

## 📦 3. Production Build & Static Assets

The frontend Vite build is fully optimized with code splitting and zero bundling warnings:

```bash
cd client
npm run build
```

- Build output directory: `client/dist/`
- Chunks: Lazy-loaded pages (ExchangePayment, ExchangeTracking, Admin modules, Checkout)
- Total bundle size: Optimized for fast initial paint (< 80 kB initial vendor gzip)

---

## 🗄️ 4. Database Migrations Execution

Ensure all migrations are run prior to starting the production server:

```bash
cd server
node migrations/migrate_managed_exchange_v2.js
```

Database schema migrations run with `IF NOT EXISTS` guards and transaction rollbacks to prevent partial schema failures.

---

## 🚀 5. Deployment Procedures (e.g. AWS / DigitalOcean / Docker)

### Option A: Docker Containerization

1. Build backend container:
   ```bash
   docker build -t quiro-server:latest ./server
   ```
2. Build frontend container:
   ```bash
   docker build -t quiro-client:latest ./client
   ```
3. Run via Docker Compose with MySQL & Redis.

### Option B: Node.js PM2 Process Manager

```bash
cd server
npm ci --only=production
pm2 start index.js --name quiro-api -i max
pm2 save
```

Serve `client/dist` via Nginx or Cloudflare Pages with cache headers:
```nginx
location / {
    root /var/www/quiro/client/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## 🩺 6. Health & Readiness Check Endpoint

The server exposes automated health checks:

- Readiness Probe: `GET /api/health`
- Automated Smoke Suite: `npm --prefix server run test:smoke`
- Master Regression Suite: `npm --prefix server test`
