# BookNest Marketplace — Local Setup & Development Guide

Welcome to **BookNest Marketplace**! This guide explains how to run, explore, and test BookNest Marketplace entirely on your local machine without any cloud deployment or external internet dependencies.

---

## 1. System Requirements & Prerequisites

- **Node.js**: v18.x, v20.x, or v22.x (Recommended: Node.js v20+)
- **NPM**: v9.x or v10+
- **MySQL Server**: v8.0+ running locally on port `3306`
- **Redis (Optional)**: If Redis is not installed, the platform automatically activates its built-in in-memory cache fallback.
- **Web Browser**: Chrome, Edge, Firefox, Safari, or Brave.

---

## 2. Directory Structure

```
booknest_gpt_ag/
├── client/              # React 18 + Vite Frontend SPA (Port 5173)
├── server/              # Node.js + Express REST & Socket.io Backend (Port 5000)
├── scripts/             # Local runners, test seeders, backup & verification tools
├── docs/                # Architecture, walkthroughs, runbooks, and QA reports
├── package.json         # Root runner scripts for single-command startup
└── README_LOCAL_SETUP.md
```

---

## 3. Environment Configuration

The backend reads configuration from `server/.env`. A pre-configured development environment is included:

- **Port**: `5000`
- **Database**: `booknest_chatgpt_ag` on `localhost:3306`
- **Auth**: JWT Authentication
- **Payments**: Sandbox Mock Mode (`PAYMENT_MODE=sandbox`)
- **AI Operations**: Local Heuristic Fallback Engine

---

## 4. Local Startup Options

### Option A: One-Command Startup (Recommended)
From the project root directory (`E:\booknest_gpt_ag`):
```bash
npm start
# or
node scripts/start-local.js
```
This concurrently starts:
1. **Node.js API Server**: `http://localhost:5000`
2. **Vite Frontend Dev Server**: `http://localhost:5173`

---

### Option B: Separate Terminal Windows

**Terminal 1 (Backend Server)**:
```bash
cd server
node index.js
# or with auto-restart:
npm run dev
```

**Terminal 2 (Frontend Client)**:
```bash
cd client
npm run dev
```

---

## 5. Local URLs & Endpoints

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5173](http://localhost:5173) | Main interactive marketplace UI |
| **Backend REST API** | [http://localhost:5000/api](http://localhost:5000/api) | API root endpoint |
| **Liveness Health Check** | [http://localhost:5000/api/health/live](http://localhost:5000/api/health/live) | Process uptime and health |
| **Readiness Health Check** | [http://localhost:5000/api/health/ready](http://localhost:5000/api/health/ready) | Database & traffic readiness |
| **Deep Dependencies Probe**| [http://localhost:5000/api/health/dependencies](http://localhost:5000/api/health/dependencies) | MySQL, Cache, and Jobs status |
| **Diagnostics Dashboard** | [http://localhost:5000/api/health/diagnostics](http://localhost:5000/api/health/diagnostics) | Full operational telemetry |

---

## 6. Pre-Configured Local Test Accounts

To seed or refresh local test accounts safely without affecting existing data:
```bash
node scripts/seed-local-test-accounts.js
```

| Role | Email / Identifier | Password | Description |
| :--- | :--- | :--- | :--- |
| **Buyer** | `buyer@booknest.local` | `Password@123` | Regular student buyer for cart, wishlist, orders, and reviews |
| **Seller** | `seller@booknest.local` | `Password@123` | Verified seller with active store, listing creation, and fulfillment |
| **Admin** | `admin@booknest.local` | `Password@123` | Marketplace administrator with full dashboard & moderation access |

---

## 7. Verification & Smoke Testing

To verify all local services and endpoints:
```bash
node scripts/verify-local-website.js
```

To run the read-only deployment smoke test suite:
```bash
npm run test:smoke
```

---

## 8. Stopping the Local Application

- **If running via `node scripts/start-local.js`**: Press `Ctrl + C` in the terminal window. Both client and server processes will shut down gracefully.
- **If running in separate terminals**: Press `Ctrl + C` in each terminal.

---

## 9. Troubleshooting Common Local Issues

1. **Port 5000 or 5173 in use**:
   - Check if an old node process is running: `netstat -ano | findstr :5000`
   - Terminate the conflicting process: `taskkill /PID <pid> /F`
2. **Database Connection Error**:
   - Verify MySQL is running in Windows Services (`services.msc` -> MySQL80).
   - Verify credentials in `server/.env`.
3. **Redis Warning**:
   - BookNest automatically uses its high-speed in-memory cache when Redis is offline. No action required.
