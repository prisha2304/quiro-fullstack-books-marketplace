# BookNest Marketplace — Local Website Walkthrough & Feature Guide

Welcome to the interactive walkthrough for **BookNest Marketplace**. This guide walks through every major user journey and verified feature available on your local instance at **`http://localhost:5173`**.

---

## 🔑 Quick Login Reference

| Persona | Credentials (Email / Password) | Target Dashboard / Starting Point |
| :--- | :--- | :--- |
| **Buyer** | `buyer@booknest.local` / `Password@123` | [http://localhost:5173/](http://localhost:5173/) |
| **Seller** | `seller@booknest.local` / `Password@123` | [http://localhost:5173/seller/dashboard](http://localhost:5173/seller/dashboard) |
| **Admin** | `admin@booknest.local` / `Password@123` | [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard) |

---

## 👤 Part 1: Buyer Journey Walkthrough

### 1. Homepage & Catalog Exploration
- **URL**: `http://localhost:5173/`
- **What to Click**:
  - Hero search bar: Type keywords (e.g. `Calculus`, `Physics`, `Novel`).
  - Category Badges: Click on **Programming**, **Fiction**, **NCERT**, or **Engineering**.
  - Featured & Trending carousels: Browse book cards displaying condition badges (`LIKE NEW`, `GOOD`), prices, and seller ratings.
- **Expected Result**: Real-time filtering updates the catalog view instantly.
- **Login Required**: No (Public).

### 2. Search & Faceted Filtering
- **URL**: `http://localhost:5173/browse` (or search bar from homepage)
- **What to Click**:
  - Filter sidebar: Select condition checkboxes (`New`, `Like New`, `Good`, `Acceptable`).
  - Price slider: Set minimum and maximum budget ranges.
  - Sort dropdown: Choose between `Price: Low to High`, `Newest`, or `Best Selling`.
- **Expected Result**: Instant catalog re-indexing with matching book counts and active filter chips.
- **Login Required**: No (Public).

### 3. Book Details Page
- **URL**: Click any book card (e.g., `http://localhost:5173/books/539`)
- **What to Click**:
  - Image gallery: View book condition photos and seller descriptions.
  - Seller trust card: View seller rating, campus department, and response rate.
  - "Add to Wishlist" (Heart icon): Saves book to personal wishlist.
  - "Add to Cart" button: Adds item to local persistent shopping cart.
  - "Request Swap" button: Opens swap modal to propose an exchange.
- **Login Required**: Viewing is public; Wishlist, Cart, and Swap require login.

### 4. Registration & Login
- **URL**: `http://localhost:5173/login` or `http://localhost:5173/register`
- **What to Click**:
  - Enter Email (`buyer@booknest.local`) and Password (`Password@123`).
  - Click **Sign In**.
- **Expected Result**: Authenticates with backend JWT, saves token in localStorage, updates navbar with user avatar and unread notification bell.
- **Login Required**: N/A (Authentication endpoint).

### 5. Shopping Cart & Sandbox Checkout
- **URL**: `http://localhost:5173/cart` (Click cart icon in navbar)
- **What to Click**:
  - Quantity controls: Adjust book quantity or remove items.
  - Coupon code input: Try discount codes (e.g., `WELCOME10`).
  - Click **Proceed to Checkout** (`http://localhost:5173/checkout`).
  - Enter shipping address details.
  - Select **Mock / Sandbox Razorpay Payment Gateway**.
  - Click **Confirm Order & Pay**.
- **Expected Result**: Simulated payment verification succeeds, order is created with status `CONFIRMED`, inventory is locked, and financial ledger records the sale.
- **Login Required**: Yes (`buyer@booknest.local`).

### 6. Order Tracking & Delivery Confirmation
- **URL**: `http://localhost:5173/orders` (or from profile dropdown)
- **What to Click**:
  - Click on any active or past order.
  - View real-time fulfillment timeline: `Confirmed` $ightarrow$ `Processing` $ightarrow$ `Dispatched` $ightarrow$ `Delivered`.
  - Once delivered, click **Confirm Delivery** or **Rate & Review**.
- **Login Required**: Yes.

### 7. Verified Reviews & Ratings
- **URL**: Completed order page or book details page.
- **What to Click**:
  - Click **Write a Review**.
  - Select Star Rating (1 to 5 stars).
  - Enter title and review text.
  - Click **Submit Review**.
- **Expected Result**: Review is saved, book average rating recalculates, and seller reputation score updates automatically.
- **Login Required**: Yes.

### 8. Book Swap (Peer Exchange)
- **URL**: `http://localhost:5173/swaps`
- **What to Click**:
  - View **Incoming** and **Outgoing** swap proposals.
  - Accept, decline, or mark swap books as dispatched.
- **Login Required**: Yes.

---

## 🏪 Part 2: Seller Journey Walkthrough

### 1. Seller Dashboard Overview
- **URL**: `http://localhost:5173/seller/dashboard` (Log in as `seller@booknest.local`)
- **What to Click**:
  - Metric cards: View **Total Revenue**, **Active Listings**, **Orders Today**, and **Seller Rating**.
  - Demand insights: View top-selling categories and pricing guidance.
- **Login Required**: Yes (`seller@booknest.local`).

### 2. Creating a New Book Listing
- **URL**: `http://localhost:5173/sell` (or click **+ Sell Book** button in navbar)
- **What to Click**:
  - Enter **Book Title**, **Author**, **ISBN**, **Genre / Category**, and **Selling Price**.
  - Select **Condition**: `NEW`, `LIKE_NEW`, `GOOD`, or `ACCEPTABLE`.
  - Toggle **Allow Swap Proposals** if interested in peer exchange.
  - Click **AI Optimize Listing** for automated description & price insights.
  - Click **Publish Listing**.
- **Expected Result**: Book is immediately published and searchable in the marketplace catalog.
- **Login Required**: Yes.

### 3. Managing Inventory & Listings
- **URL**: `http://localhost:5173/seller/listings` (or My Listings)
- **What to Click**:
  - Filter listings by status: `Active`, `Pending Review`, `Sold`, `Reserved`.
  - Edit prices or mark items as discounted to trigger buyer price alerts.
- **Login Required**: Yes.

### 4. Seller Order Fulfillment
- **URL**: `http://localhost:5173/seller/orders`
- **What to Click**:
  - View incoming buyer orders.
  - Click **Mark as Processing** $ightarrow$ **Dispatch Order**.
  - Enter courier tracking number (e.g., `FEDEX-987654`).
- **Expected Result**: Order status transitions to `SHIPPED`, buyer receives in-app and socket notification.
- **Login Required**: Yes.

### 5. Seller Financial Summaries & Payouts
- **URL**: `http://localhost:5173/seller/financials`
- **What to Click**:
  - View breakdown of gross revenue, 10% marketplace commission, and net earnings.
  - Review settled and pending escrow balances.
- **Login Required**: Yes.

---

## 🛡️ Part 3: Administrator Walkthrough

### 1. Admin Marketplace Dashboard
- **URL**: `http://localhost:5173/admin/dashboard` (Log in as `admin@booknest.local`)
- **What to Click**:
  - High-level KPI tiles: Platform GMV, Active Users, Order Volume, Open Disputes.
  - Activity Feed: Live feed of transactions, registrations, and reviews.
- **Login Required**: Yes (`admin@booknest.local` with role `ADMIN`).

### 2. Seller Onboarding & Operations
- **URL**: `http://localhost:5173/admin/operations`
- **What to Click**:
  - Review seller KYC submissions.
  - Approve or verify seller campus credentials.
- **Login Required**: Yes.

### 3. Listing Moderation & Quality Queue
- **URL**: `http://localhost:5173/admin/moderation`
- **What to Click**:
  - Inspect flagged listings and AI quality scores.
  - Approve or reject listings with moderation feedback notes.
- **Login Required**: Yes.

### 4. Trust & Safety, Disputes & Reports
- **URL**: `http://localhost:5173/admin/disputes`
- **What to Click**:
  - View active buyer-seller dispute tickets.
  - Read dispute message thread and evidence.
  - Issue human-controlled resolution (e.g., approve refund or dismiss dispute).
- **Login Required**: Yes.

### 5. Marketplace Intelligence & Analytics
- **URL**: `http://localhost:5173/admin/intelligence`
- **What to Click**:
  - View demand vs. supply heatmaps across genres.
  - Check search conversion funnel metrics and catalog gap reports.
- **Login Required**: Yes.

### 6. Production Health & Diagnostics Dashboard
- **URL**: `http://localhost:5173/admin/health`
- **What to Click**:
  - Live latency probes for MySQL, In-memory Cache, Background Job Engine, and Webhooks.
  - Error rate tracking (4xx/5xx metrics) and server uptime monitor.
- **Login Required**: Yes.

---

## 💡 Tips for Local Interactive Testing

1. **Simulate Buyer and Seller Interaction**: Open an **Incognito / Private Window** alongside your main browser.
   - Main Window: Log in as **Seller** (`seller@booknest.local`) and create a listing.
   - Incognito Window: Log in as **Buyer** (`buyer@booknest.local`), search for the listing, add to cart, and complete purchase.
   - Switch back to Seller window to fulfill the order!
2. **Real-Time Sockets**: Sockets automatically broadcast order status changes and chat messages between active browser tabs.
