# QUIRO — Local Environment Setup Guide

Follow this guide to run QUIRO locally for development, demonstration, and automated test execution.

---

## 📋 Prerequisites

1. **Node.js**: v18.0.0 or higher (v22 LTS recommended)
2. **npm**: v9.0.0 or higher
3. **MySQL**: v8.0 or higher running on `localhost:3306`

---

## ⚙️ Environment Variables

### 1. Server Configuration (`server/.env`)

Ensure `server/.env` contains the following variables:

```ini
PORT=5000
NODE_ENV=development

# Database Settings
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=quiro
DB_PORT=3306

# Authentication & Security
JWT_SECRET=quiro_super_secret_jwt_key_2026_production
CLIENT_URL=http://localhost:5173

# Payment Gateway (Razorpay Test Mode)
RAZORPAY_KEY_ID=rzp_test_booknest_sandbox
RAZORPAY_KEY_SECRET=rzp_test_secret_sandbox

# Exchange Logistics Configuration
SWAP_SHIPPING_FEE=79.00
```

### 2. Client Configuration (`client/.env`)

```ini
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_booknest_sandbox
```

---

## 💾 Database Setup & Migrations

To apply database schema migrations:

```bash
# Apply Managed Exchange v2 schema
node server/migrations/migrate_managed_exchange_v2.js
```

---

## 🚀 Running the Application Locally

### 1. Start the Express Backend Server

```bash
cd server
npm install
npm run dev
```

The API will start at: `http://localhost:5000`
WebSocket server binds at: `ws://localhost:5000`

### 2. Start the Vite React Frontend

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

The frontend will open at: `http://localhost:5173`

---

## 🧪 Running Automated Tests

All automated tests can be run against your local database:

```bash
# Run Master Suite (all 5 test suites)
npm --prefix server test

# Run individual test suites
npm --prefix server run test:smoke
npm --prefix server run test:swaps
npm --prefix server run test:payments
```
