# BookNest Marketplace — Phase 15 Credential & Environment Setup Guide

This guide details all credentials, API keys, and environment variables used across the BookNest platform. It clarifies which are strictly required for local testing vs. optional external providers, where to acquire them, and how to verify each integration safely.

---

## 1. Quick Local Development Matrix

| Service / Provider | Purpose | Environment Variable(s) | Required for Local Dev? | Default Fallback if Missing |
| :--- | :--- | :--- | :---: | :--- |
| **JWT Authentication** | Session token signing & auth | `JWT_SECRET` | **YES** | Built-in secure 64-char key |
| **MySQL Database** | Persistent catalog, orders, users | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **YES** | Local MySQL instance (`schema.sql`) |
| **Local File Storage** | Book covers & photo uploads | (None required) | **YES** | Built-in `/uploads` static directory |
| **Google Sign-In (OAuth)** | One-click Google authentication | `GOOGLE_CLIENT_ID`<br>`VITE_GOOGLE_CLIENT_ID` | Optional | Informative setup prompt badge |
| **AI Provider (NestAI)** | Contextual chat & LLM advice | `AI_PROVIDER`, `OPENAI_API_KEY` or `GEMINI_API_KEY` | Optional | Factual DB catalog matching |
| **Razorpay Payments** | UPI, Cards & NetBanking | `RAZORPAY_KEY_ID`<br>`RAZORPAY_KEY_SECRET` | Optional | Zero-charge test sandbox mode |
| **Redis Cache** | Performance acceleration | `REDIS_HOST`, `REDIS_PORT` | Optional | High-speed In-Memory Cache |
| **Cloudinary** | Cloud CDN image hosting | `CLOUDINARY_CLOUD_NAME`, `API_KEY` | Optional | Local disk storage (`public/uploads`) |

---

## 2. Detailed Provider Configuration

### 2.1 JWT Secret (No External Provider Needed)
- **Why it is needed:** Cryptographically signs and verifies session tokens for authenticated users and admins.
- **Where to obtain:** Generated locally via terminal.
- **Generation Command:**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Where to put it:**
  - `server/.env` → `JWT_SECRET=your_generated_64_character_hex_string`
- **Verification:** Run `POST /api/auth/login` or test login in UI. A valid JWT token is returned.

---

### 2.2 Google OAuth 2.0 / OpenID Connect
- **Why it is needed:** Allows users and buyers to sign up / sign in seamlessly using their verified Google identity.
- **Where to obtain:**
  1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
  2. Create a Project (e.g., `BookNest-Local`).
  3. Configure OAuth Consent Screen (User Type: External, Publishing Status: Testing).
  4. Create **OAuth 2.0 Client ID** (Application type: *Web application*).
  5. Set **Authorized JavaScript origins:**
     - `http://localhost:5173`
     - `http://localhost:5000`
  6. Set **Authorized redirect URIs:**
     - `http://localhost:5173`
     - `http://localhost:5000/api/auth/google/callback`
  7. Copy your **Client ID** and **Client Secret**.
- **Where to put it:**
  - `server/.env` → `GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com`
  - `server/.env` → `GOOGLE_CLIENT_SECRET=your_client_secret`
  - `client/.env` → `VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com`
- **Verification:** Click "Continue with Google" on `http://localhost:5173/login`. You will be authenticated and redirected to `/dashboard`.

---

### 2.3 AI Provider (OpenAI / Google Gemini)
- **Why it is needed:** Powers NestAI's natural conversational explanations, study bundle advisor, and price insights.
- **Where to obtain:**
  - **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - **Google Gemini:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Where to put it:**
  - **For OpenAI:**
    ```env
    AI_PROVIDER=openai
    OPENAI_API_KEY=sk-proj-your_actual_key_here
    OPENAI_MODEL=gpt-4o-mini
    ```
  - **For Google Gemini:**
    ```env
    AI_PROVIDER=gemini
    GEMINI_API_KEY=AIzaSy_your_gemini_key_here
    GEMINI_MODEL=gemini-1.5-flash
    ```
- **Verification:** Open NestAI floating chat and ask: *"Recommend books under ₹400 for Programming"*. It responds with conversational advice grounded in catalog data.

---

### 2.4 Razorpay Payment Gateway (Test Mode)
- **Why it is needed:** Accepts mock payments for book orders via UPI, Cards, and NetBanking using Razorpay's Standard Checkout modal.
- **Where to obtain:**
  1. Create a free account at [dashboard.razorpay.com](https://dashboard.razorpay.com).
  2. Switch the dashboard toggle from **Live Mode** to **Test Mode**.
  3. Navigate to **Settings → API Keys → Generate Key**.
  4. Copy **Key ID** (`rzp_test_...`) and **Key Secret**.
  5. Navigate to **Settings → Webhooks → Add Webhook** (optional for local; requires ngrok for inbound webhooks):
     - Webhook URL: `https://your-ngrok-url/api/webhooks/payment`
     - Secret: Set your custom webhook secret string.
     - Events: `payment.captured`, `payment.failed`, `order.paid`.
- **Where to put it:**
  - `server/.env`:
    ```env
    RAZORPAY_KEY_ID=rzp_test_your_test_key_id
    RAZORPAY_KEY_SECRET=your_test_key_secret
    RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
    ```
- **Verification:** Add a book to cart, proceed to `/checkout`, click "Pay with Razorpay". The official test modal opens allowing successful test payments with dummy UPI/cards.

---

### 2.5 Cloudinary (Optional Cloud Storage)
- **Why it is needed:** Uploads book images to Cloudinary CDN instead of storing locally on the server disk.
- **Where to obtain:** Free account at [cloudinary.com](https://cloudinary.com/console).
- **Where to put it:**
  - `server/.env`:
    ```env
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    ```
- **Default Fallback:** When absent or left as placeholders, BookNest automatically saves files locally to `server/public/uploads` and serves them statically at `http://localhost:5000/uploads/...`.

---

## 3. Environment Variable Security Best Practices

1. Real `.env` files are strictly included in `.gitignore` and **must never be committed**.
2. Frontend variables exposed to Vite must always begin with `VITE_` and never contain backend secrets (e.g. `RAZORPAY_KEY_SECRET` or `JWT_SECRET`).
3. For team onboarding or public git pushes, copy safe templates to `.env.example`.
