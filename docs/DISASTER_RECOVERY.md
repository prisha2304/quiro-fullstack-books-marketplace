# BookNest Marketplace — Disaster Recovery & Operational Runbook

## 1. Executive Summary & Infrastructure Reality
- **Primary Database**: MySQL 8.0 (Relational core: Users, Books, Orders, Payments, Ledger, Disputes).
- **Cache / Message Layer**: Redis with high-speed in-memory LRU fallback.
- **Real-Time Layer**: Socket.io over Node.js Express Cluster.
- **Automated Backup Status**: **LOCAL FILE BACKUP CONFIGURED / CLOUD AUTOMATED SNAPSHOTS REQUIRE CLOUD DB HOSTING (e.g. AWS RDS / DigitalOcean Managed DB)**.

---

## 2. Database Backup Procedures

### A. Logical Hot Backup (mysqldump)
Run daily during non-peak campus hours (e.g., 03:00 AM IST):
```bash
mysqldump -u root -p --single-transaction --quick --routines --triggers booknest_chatgpt_ag > backup_$(date +%Y%m%d_%H%M%S).sql
```

### B. Compression & Secure Storage
```bash
gzip backup_*.sql
# Transfer to offsite encrypted storage (e.g., S3 Glacier / GCS Archive)
```

---

## 3. Database Restore Procedures

### Step 1: Drain In-Flight Traffic
Set application to Maintenance mode:
```bash
# Set maintenance flag via feature flags API or nginx reverse proxy
curl -X PUT http://localhost:5000/api/intelligence/feature-flags/MAINTENANCE_MODE -d '{"enabled": true}'
```

### Step 2: Target Database Preparation
```sql
DROP DATABASE IF EXISTS booknest_chatgpt_ag;
CREATE DATABASE booknest_chatgpt_ag CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 3: Stream Restore
```bash
gunzip < backup_20260925.sql.gz | mysql -u root -p booknest_chatgpt_ag
```

### Step 4: Run Post-Restore Migration Validation
```bash
node server/migrate_phase5.js
node server/migrate_phase6.js
node server/migrate_phase7.js
node server/migrate_phase8.js
node server/migrate_phase9.js
node server/migrate_phase10.js
node server/migrate_phase11.js
```

---

## 4. Disaster Recovery Scenarios & Playbooks

| Incident Scenario | Severity | Action & Recovery Steps |
| :--- | :--- | :--- |
| **Corrupted Financial Ledger / Database Failure** | CRITICAL | 1. Lock API traffic.<br>2. Restore latest verified snapshot.<br>3. Replay Razorpay webhook events from `payment_webhook_events` table.<br>4. Run `test_phase7.js` to verify financial balance invariants. |
| **Payment Webhook Surge / Missed Events** | HIGH | 1. Query unprocessed webhooks from `payment_webhook_events WHERE status = 'RECEIVED'`.<br>2. Trigger batch webhook reprocessing via `WebhookService.processPaymentWebhook`. |
| **Stale / Frozen Inventory Locks** | MEDIUM | 1. Trigger `EXPIRE_RESERVATIONS` job from `jobEngineService` or admin diagnostics dashboard.<br>2. Verify available stock balance. |
| **Redis Cache Outage** | LOW | 1. System automatically falls back to High-Speed In-Memory Cache.<br>2. Restart Redis container / service.<br>3. Verify `GET /api/health/dependencies` returns `cache: UP`. |

---

## 5. Secret Restoration & Key Hygiene
- Never store secrets in version control.
- Backup encryption keys must be held in secure key vaults (e.g. AWS KMS / HashiCorp Vault).
- On compromise: rotate JWT Secret, Cloudinary credentials, and Razorpay webhook secret immediately.
