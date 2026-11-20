# BookNest Marketplace — Production API Documentation (v1)

## Overview
- **Base URL**: `/api/v1` (with backward-compatible `/api` aliases)
- **Authentication**: JWT Bearer Token (`Authorization: Bearer <TOKEN>`)
- **Standard Request Header**: `X-Request-ID: <UUID>` (Returned in every response for correlation)
- **Standard Response Format**: JSON

---

## Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation of error",
    "requestId": "req_a1b2c3d4e5f6"
  }
}
```

### Standard Error Codes
- `AUTH_REQUIRED` (401): Missing or expired authentication token.
- `FORBIDDEN` (403): User does not have RBAC privileges (e.g., non-admin accessing admin routes).
- `VALIDATION_ERROR` (400): Invalid request parameters or payload body.
- `NOT_FOUND` (404): Requested entity does not exist.
- `CONFLICT` (409): Duplicate idempotency key or conflicting state transition.
- `RATE_LIMITED` (429): Rate limit exceeded.
- `DATABASE_ERROR` (500): Relational query failure (masked in production).
- `INTERNAL_ERROR` (500): Unexpected system error.

---

## Core Endpoints Summary

### 1. Health & Diagnostics
- `GET /api/v1/health/live` — Process liveness (200 UP)
- `GET /api/v1/health/ready` — Service readiness check (200 UP / 503 DOWN)
- `GET /api/v1/health/dependencies` — Deep dependencies check (MySQL, Cache, Config, Jobs)
- `GET /api/v1/health/metrics` — Operational latency and error rates
- `GET /api/v1/health/diagnostics` — Production diagnostics payload (Admin)

### 2. Marketplace Intelligence & Operations
- `GET /api/v1/intelligence/demand` — Category demand forecasts
- `GET /api/v1/intelligence/catalog` — Catalog gap detection
- `GET /api/v1/intelligence/funnel` — Conversion funnel drop-off analytics
- `GET /api/v1/intelligence/buyers` — Buyer lifecycle cohort analytics *(Admin)*
- `GET /api/v1/intelligence/sellers` — Seller lifecycle cohort analytics *(Admin)*
- `GET /api/v1/intelligence/recommendations` — Orchestrated diverse recommendations
- `GET /api/v1/intelligence/experiments` — A/B experiment framework
- `GET /api/v1/intelligence/feature-flags` — Dynamic feature flags

### 3. Payments & Webhooks
- `POST /api/v1/payments/create-order` — Create payment intent & reserve inventory
- `POST /api/v1/payments/verify` — Cryptographic signature verification & order completion
- `POST /api/v1/webhooks/payment` — Idempotent payment gateway webhook endpoint
