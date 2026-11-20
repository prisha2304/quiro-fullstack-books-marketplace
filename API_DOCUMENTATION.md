# QUIRO — REST API Documentation

Base URL: `http://localhost:5000/api`

---

## 📚 Book Catalog Endpoints

### 1. `GET /api/books`
Fetch paginated books with search, sorting, and genre filters.
- **Query Parameters:**
  - `page` (number, default: 1)
  - `limit` (number, default: 20)
  - `search` (string, matches title, author, ISBN, or genre)
  - `genre` (string, category name)
  - `sort` (`newest`, `price_asc`, `price_desc`, `rating_desc`, `views_desc`)
- **Response:**
  ```json
  {
    "books": [
      {
        "id": 1,
        "title": "To Kill a Mockingbird",
        "author": "Harper Lee",
        "price": 299.00,
        "condition": "Like New",
        "genre": "Fiction",
        "swap_enabled": 1,
        "cover_image": "/images/covers/mockingbird.jpg"
      }
    ],
    "total": 509,
    "page": 1,
    "totalPages": 26
  }
  ```

### 2. `GET /api/books/:id`
Fetch single book details including seller information and average rating.

### 3. `GET /api/books/suggestions?q=:query`
Instant autocomplete suggestions for title, author, and category matches.

---

## 🔄 Book Exchange Marketplace Endpoints

### 1. `GET /api/swaps/config`
Retrieve configurable exchange logistics fees, breakdown, and courier stage definitions.
- **Auth:** Optional
- **Response:**
  ```json
  {
    "shippingFeePerUser": 79.00,
    "currency": "INR",
    "currencySymbol": "₹",
    "breakdown": {
      "baseShipping": 55.30,
      "packagingAndHandling": 15.80,
      "protectiveInsurance": 7.90
    },
    "totalPerUser": 79.00,
    "totalExchange": 158.00,
    "courierStages": [ ... ]
  }
  ```

### 2. `GET /api/swaps/discover`
Discover available books listed by other readers for swapping. Excludes listings belonging to the authenticated user.

### 3. `POST /api/swaps/request`
Submit a swap proposal offering a personal volume in trade for another reader's book.
- **Auth:** Required
- **Body:**
  ```json
  {
    "requested_book_id": 102,
    "offered_book_id": 45,
    "message": "Care to trade for my like-new copy?"
  }
  ```

### 4. `PUT /api/swaps/:id/accept`
Accept an incoming swap proposal (owner action only). Automatically reserves both books.

### 5. `POST /api/swaps/:id/select-method`
Record exchange method preference (`SELF_ARRANGED` or `QUIRO_MANAGED`).
- **Body:**
  ```json
  { "method": "QUIRO_MANAGED" }
  ```

### 6. `POST /api/swaps/:id/address`
Submit and confirm pickup & delivery address for QUIRO Managed Exchange.
- **Body:**
  ```json
  {
    "full_name": "Aarav Patel",
    "phone": "9876543210",
    "pickup_address": "Flat 402, Lotus Orchid, Andheri West",
    "delivery_address": "Flat 402, Lotus Orchid, Andheri West",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400053",
    "delivery_instructions": "Leave with security if not home"
  }
  ```

### 7. `POST /api/swaps/:id/create-payment`
Create Razorpay order for exchange logistics fee (₹79.00). Requires method agreement and both addresses confirmed.

### 8. `POST /api/swaps/:id/verify-payment`
Verify Razorpay HMAC signature and record captured fee. Dispatches courier when both parties have paid.
- **Body:**
  ```json
  {
    "razorpay_order_id": "order_XXXXX",
    "razorpay_payment_id": "pay_XXXXX",
    "razorpay_signature": "signature_XXXXX"
  }
  ```

### 9. `POST /api/swaps/:id/advance-courier`
Advance DEMO simulator courier tracking through the 10 sequential stages.
- **Body:**
  ```json
  { "stage": "book_collected" }
  ```

### 10. `POST /api/swaps/:id/confirm-completion`
Record participant receipt confirmation. Marks swap and books as `completed`/`swapped` once both confirm.

---

## 💳 Payment & Checkout Endpoints

### 1. `POST /api/payments/create-order`
Create Razorpay order for cart or direct buy-now purchases.

### 2. `POST /api/payments/verify`
Verify Razorpay signature with idempotency key headers and record payment in order ledger.
