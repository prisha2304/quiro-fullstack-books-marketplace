# BookNest Marketplace — Phase 13 Comprehensive System Audit

## 1. System Architecture Overview
- **Frontend**: React 18 with Vite, Tailwind CSS, Lucide Icons, React Router v6 (lazy-loaded chunking), Context API for Auth and WebSockets.
- **Backend**: Node.js v22 with Express 5, Socket.io for real-time bidirectional messaging, MySQL 8.0 connection pool (`mysql2`), structured logger with credentials auto-redaction.
- **Caching Layer**: Redis client with automatic fallback to high-speed in-memory LRU store.
- **Security**: JWT Bearer token authentication, Role-Based Access Control (RBAC: USER, SELLER, ADMIN), Helmet security headers, Express Rate Limiter, HMAC-SHA256 signature verification for Razorpay webhooks, and parameterized SQL queries across all services.

---

## 2. API Route & Subsystem Inventory (Mounted under /api and /api/v1)
| Subsystem Route | Purpose | Key Controllers / Services |
| :--- | :--- | :--- |
| `/api/v1/auth` | Authentication, Registration & Session | `authRoutes.js`, `authController.js` |
| `/api/v1/books` | Catalog listings, CRUD & status management | `bookRoutes.js`, `bookController.js` |
| `/api/v1/categories` | Genre taxonomy & cached category metadata | `categoryRoutes.js`, `categoryController.js` |
| `/api/v1/search` | Multi-modal search, typo-tolerance & ISBN lookup | `searchRoutes.js`, `searchService.js` |
| `/api/v1/cart` | Cart management & inventory locks | `cartRoutes.js`, `cartController.js` |
| `/api/v1/orders` | Order state machine & fulfillment workflow | `orderRoutes.js`, `orderController.js` |
| `/api/v1/payments` | Razorpay intent creation, verification & ledger | `paymentRoutes.js`, `paymentService.js` |
| `/api/v1/webhooks` | Idempotent payment gateway webhook ingestion | `webhookRoutes.js`, `webhookService.js` |
| `/api/v1/financials` | Seller earnings, 5% platform fee & ledger logs | `financialRoutes.js`, `financialService.js` |
| `/api/v1/seller` | Seller onboarding, listing quality & SLA engine | `sellerOperationsRoutes.js`, `sellerOperationsService.js` |
| `/api/v1/reviews` | Verified buyer reviews & reputation rating | `reviewRoutes.js`, `reviewController.js` |
| `/api/v1/wishlist` | Wishlist bookmarks, price alerts & stock alerts | `wishlistRoutes.js`, `personalizationService.js` |
| `/api/v1/swaps` | Peer-to-peer textbook swapping lifecycle | `swapRoutes.js`, `swapController.js` |
| `/api/v1/disputes` | Buyer/Seller dispute arbitration & evidence | `disputeRoutes.js`, `trustSafetyService.js` |
| `/api/v1/reports` | Content & seller violation reporting | `reportRoutes.js`, `reportController.js` |
| `/api/v1/ai` | NestAI chat, search intent & seller copilot | `aiRoutes.js`, `aiService.js`, `aiMarketplaceOperationsService.js` |
| `/api/v1/intelligence` | Demand forecast, catalog gaps, funnel & A/B tests | `intelligenceRoutes.js`, `marketplaceIntelligenceService.js` |
| `/api/v1/health` | Liveness, readiness, dependencies & diagnostics | `healthRoutes.js`, `metricsService.js` |

---

## 3. Database Schema Tables Inventory
The database contains 52 normalized tables across core marketplace domains:
- **Core Entities**: `users`, `books`, `categories`, `cart_items`, `orders`, `order_items`
- **Financial & Escrow**: `payments`, `payment_refunds`, `payment_idempotency`, `payment_webhook_events`, `financial_ledger`, `seller_payouts`
- **Seller Operations**: `seller_onboarding`, `listing_moderation`, `seller_sla_events`, `shipments`, `shipment_events`
- **Trust & Safety**: `disputes`, `dispute_messages`, `dispute_evidence`, `reports`, `audit_logs`, `security_events`
- **AI & Intelligence**: `ai_activity_logs`, `ai_cached_insights`, `ai_chat_history`, `ai_anomalies`, `marketplace_experiments`, `experiment_events`, `feature_flags`, `intelligence_reports`, `automation_jobs`, `job_executions`, `marketplace_health_snapshots`
- **Social & Growth**: `reviews`, `review_helpful_votes`, `wishlists`, `price_alerts`, `stock_alerts`, `swap_requests`, `notifications`, `seller_follows`, `user_activity`, `user_achievements`
- **Deployment**: `schema_migrations`

---

## 4. Known Limitations & Production Constraints
1. **Live Payment Gateway**: Production requires real credentials in `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. In test and sandbox environments, HMAC signature checks run against test secrets.
2. **Redis Cluster**: Operates with high-speed in-memory LRU fallback when Redis host is not reachable.
3. **Cloud Media Storage**: Defaults to local disk storage (`server/public/uploads`) when Cloudinary credentials are not configured.
4. **Human-in-the-Loop Safeguard**: Automated workflows and AI agents strictly do not auto-refund, auto-suspend sellers, or alter ledger records without human review.
