# BookNest Marketplace — Quick Start Guide

Run, explore, and test BookNest Marketplace on your computer in under 1 minute.

---

## 🚀 1. How to Start the Application

Open your terminal in `E:\booknest_gpt_ag` and run:

```bash
npm start
```
*(Or run `node scripts/start-local.js`)*

Both the backend and frontend dev servers will launch concurrently.

---

## 🌐 2. Open in Your Browser

Open your browser to:

### 👉 **[http://localhost:5173](http://localhost:5173)**

The local homepage is the best starting point to explore categories, search books, and test user journeys.

---

## 👥 3. Test Personas & Credentials

Use these pre-configured test accounts to explore each role:

| Persona | Email / Identifier | Password | Best Features to Test |
| :--- | :--- | :--- | :--- |
| **Buyer** | `buyer@booknest.local` | `Password@123` | Browse, Cart, Sandbox Checkout, Wishlist, Reviews, Swaps |
| **Seller** | `seller@booknest.local` | `Password@123` | Listing Creation, AI Optimizer, Inventory, Order Dispatch, Payouts |
| **Admin** | `admin@booknest.local` | `Password@123` | Moderation Queue, Disputes, Operations KPIs, Diagnostics |

---

## 🔍 4. Health & Diagnostics Checks

- **Backend Status**: [http://localhost:5000/api/health/live](http://localhost:5000/api/health/live)
- **Database & Services Readiness**: [http://localhost:5000/api/health/ready](http://localhost:5000/api/health/ready)
- **Dependencies Snapshot**: [http://localhost:5000/api/health/dependencies](http://localhost:5000/api/health/dependencies)
- **Interactive Smoke Test**:
  ```bash
  node scripts/verify-local-website.js
  ```

---

## 🛑 5. How to Stop the Application

Press **`Ctrl + C`** in your terminal window to shut down both servers cleanly.

---

## 🔧 6. Troubleshooting

- **MySQL Connection Error**: Ensure MySQL is started locally on port 3306. Check credentials in `server/.env`.
- **Port Conflict**: If port 5000 or 5173 is in use, check `netstat -ano | findstr :5000` and kill the orphaned process.
- **Cache Fallback**: Redis is optional. When offline, high-speed in-memory caching is automatically engaged.
