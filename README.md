# QUIRO — Pre-Loved Book Marketplace & Peer Exchange

> **"Your Next Chapter Could Be Someone's First."**

**QUIRO** is an end-to-end literary marketplace and peer-to-peer book exchange platform built for readers, collectors, and students across India. It combines pre-loved book sales with a direct, escrow-protected book swap barter ecosystem.

---

## 🎨 Official Brand Identity & Palette

- **Brand Name:** QUIRO
- **Official Tagline:** *Your Next Chapter Could Be Someone's First.*
- **Official Logo:** `/quiro-logo.png`
- **Official Palette:**
  - **Deep Aubergine (`#35152F`)**: Primary brand color for headings, primary buttons, brand accents, and active tabs.
  - **Ice Silver (`#DCE2E8`)**: Secondary brand color for cards, borders, input frames, and clean structural dividers.
  - **Marigold (`#E5A323`)**: Accent highlight color for badges, swap tags, interactive focus states, and key alerts.
  - **Soft Ivory (`#FAF9F6`)**: Neutral editorial background for relaxed long-session reading.

---

## 🌟 Key Product Features

### 1. Cross-User Book Swap Marketplace
- **Discover Swap Books:** Browse active swap-enabled books listed by other readers. The viewer's own listings are excluded automatically.
- **Mutual Exchange Proposals:** Readers propose trades by offering a volume from their personal shelf in return for a desired book.
- **Two Flexible Fulfillment Paths:**
  - **Option A — Direct Self-Arranged Exchange:** Free peer-to-peer handover with strict mutual-consent email disclosure gating.
  - **Option B — QUIRO Managed Courier Delivery:** Doorstep round-trip logistics with automated address verification, split fee escrow (₹79.00 each), and a complete 10-stage courier tracking simulation.
- **Two-Party Receipt Confirmation:** Requires both readers to confirm physical delivery with immutable timestamps (`requester_confirmed_at`, `owner_confirmed_at`).

### 2. Verified Pre-Loved Book Marketplace
- **Comprehensive Taxonomy:** 49 structured literary categories across 9 parent genres (Fiction, Non-Fiction, Romance, Mystery & Thriller, Fantasy & Sci-Fi, Academic & Professional, Self-Help, Horror, Young Readers).
- **Multi-Field Instant Search:** Search across title, author, ISBN, publisher, and genre with live autocomplete suggestions and recent inquiry caching.
- **Secure Online Checkout:** Razorpay test mode integration with server-side HMAC signature verification, idempotency protection, and verified condition guarantees.

### 3. Seller & Merchant Studio
- **Listing Management:** Add or edit books with multi-image uploads, condition ratings (Like New, Good, Acceptable), pricing recommendations, and swap toggling.
- **Financials & Payouts:** Real-time earnings calculations, commission breakdown, and order fulfillment status.

### 4. Admin Intelligence & Operations
- **System Health Monitor:** Real-time production readiness dashboard with latency benchmarks, database health checks, and security event logs.
- **Catalog Moderation:** Manage users, listings, disputes, announcements, and promotional discount coupons.

---

## 🏗️ Technology Architecture

```
e:\booknest_gpt_ag\
├── client\                  # React 19 + Vite Frontend SPA
│   ├── src\
│   │   ├── components\      # Navbar, BookCard, Hero, Exchange modals
│   │   ├── context\         # AuthContext, MarketplaceContext, SocketContext
│   │   ├── pages\           # Home, Browse, Checkout, SwapRequests, ExchangePayment, ExchangeTracking
│   │   └── services\        # Axios API clients (swapService, paymentService, etc.)
│   └── public\quiro-logo.png# Official brand logo asset
└── server\                  # Express.js REST API & WebSocket Backend
    ├── config\              # MySQL connection pool, environment configuration
    ├── controllers\         # swapController, paymentController, bookController
    ├── middleware\          # JWT auth protection, rate limiting, request validation
    ├── models\              # Swap, Book, User, Order, Review
    └── tests\               # Automated regression and workflow test suites
```

---

## 🧪 Testing & Verification

Run the master test runner to execute all automated test suites:

```bash
npm --prefix server test
```

Suite breakdown:
- `npm --prefix server run test:smoke`: 14 read-only production sanity checks.
- `npm --prefix server run test:swaps`: 35-test end-to-end swap workflow & 10-stage courier dispatch suite.
- `npm --prefix server run test:payments`: 41-test Razorpay checkout, verification, and seller profile test suite.

---

## 📄 License & Intellectual Property

Proprietary application developed for the QUIRO Book Marketplace. All rights reserved.
