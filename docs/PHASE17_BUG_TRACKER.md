# BookNest Marketplace — Phase 17 Bug Tracker & Quality Assurance Log

- **Phase:** Phase 17 — Complete End-to-End Testing, Quality Assurance & UX Polish
- **Date:** November 6, 2026
- **Test Suite:** `server/test_phase17.js` (47/47 Automated Assertions Passed)
- **Environment:** Local Node.js + Express / MySQL / Vite React

---

## Severity Classification Taxonomy

| Severity | Definition | Action Required |
| :--- | :--- | :--- |
| **P0 (Blocker)** | Critical vulnerability, complete system crash, data loss, or payment breakdown. | Immediate fix & rollback protection. |
| **P1 (High)** | Core workflow blocked for users, authentication failure, or order lifecycle stall. | Fix before phase release sign-off. |
| **P2 (Medium)** | Non-breaking functional bug, dead UI button, missing error handling, or state inconsistency. | Fix and verify in test suite. |
| **P3 (Low)** | Visual defect, improper fallback image, cosmetic alignment, or minor UX friction. | Polish and standardize. |

---

## Phase 17 Defect Inventory & Resolution Matrix

| Bug ID | Severity | Category | Description | Root Cause | Affected Files | Fix Applied | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-P17-001** | **P1** | Buyer Journey / Cart | Guest cart blocked; viewing cart required login, causing 401 errors for unauthenticated users. | `/cart` route was wrapped in `<ProtectedRoute>` in `App.jsx`. `MarketplaceContext.jsx` called `/api/cart` directly without a token. | `client/src/App.jsx`<br>`client/src/context/MarketplaceContext.jsx`<br>`client/src/pages/Cart.jsx` | Made `/cart` public (leaving `/checkout` protected). Implemented `localStorage` guest cart persistence (`booknest_guest_cart`), counting, and automated guest-to-account merge upon authentication. | **RESOLVED & VERIFIED** |
| **BUG-P17-002** | **P2** | UI / Discovery | Dead "Add to Cart" button in `QuickPreviewModal.jsx`. | The button on line 78 had no `onClick` handler and no connection to `MarketplaceContext`. | `client/src/components/QuickPreviewModal.jsx` | Connected `useMarketplace().addToCart(book.id, book)`, closed modal with toast feedback, and disabled button for out-of-stock items. | **RESOLVED & VERIFIED** |
| **BUG-P17-003** | **P2** | Orders / Lifecycle | Buyers could not cancel `pending` or `confirmed` orders prior to dispatch. | `updateOrderStatus` was restricted to sellers and admins. No buyer order cancellation endpoint existed in backend. | `server/controllers/orderController.js`<br>`server/routes/orderRoutes.js`<br>`client/src/services/orderService.js`<br>`client/src/pages/OrderTracking.jsx` | Created transactional `cancelOrder` controller releasing book inventory (`UPDATE books SET status = 'available'`), releasing reservations, updating payment status, and dispatching socket alerts. Added UI cancellation button. | **RESOLVED & VERIFIED** |
| **BUG-P17-004** | **P2** | Mobile UX | Navigation links (Browse, Sell, Swap) inaccessible on screens `< lg`. | Navigation links used `hidden lg:flex` without a mobile hamburger menu or drawer. | `client/src/components/Navbar.jsx` | Added mobile hamburger button (`Menu`/`X`) and slide-down drawer with links to Browse, Sell, Swap, Cart, Wishlist, Orders, Dashboard, and Auth. | **RESOLVED & VERIFIED** |
| **BUG-P17-005** | **P3** | Asset Integrity | Raw `<img>` tags with Unsplash stock photos and generic placeholder fallbacks across 13 pages. | Hardcoded `images.unsplash.com` and `via.placeholder.com` fallbacks left over from early prototype stages. | `client/src/components/Navbar.jsx`<br>`client/src/components/QuickPreviewModal.jsx`<br>`client/src/components/ImageGallery.jsx`<br>`client/src/pages/Cart.jsx`<br>`client/src/pages/Checkout.jsx`<br>`client/src/pages/Orders.jsx`<br>`client/src/pages/OrderTracking.jsx`<br>`client/src/pages/SellerOrders.jsx`<br>`client/src/pages/SwapRequests.jsx`<br>`client/src/pages/MyListings.jsx`<br>`client/src/pages/Wishlist.jsx`<br>`client/src/pages/BookDetails.jsx`<br>`client/src/pages/DisputeDetail.jsx` | Replaced all raw `<img>` tags and hardcoded gallery arrays with `<OptimizedImage>`, utilizing the standardized BookNest SVG fallback without external CDN dependencies. | **RESOLVED & VERIFIED** |
| **BUG-P17-006** | **P2** | Backend / AI | Syntax error in `aiService.js` `BUYING_DECISION` engine. | Truncated conditional block resulted in `SyntaxError: missing ) after argument list`. | `server/services/aiService.js` | Restructured query evaluation, price benchmark comparison, and fallback guidance for `BUYING_DECISION` intent. | **RESOLVED & VERIFIED** |
| **BUG-P17-007** | **P2** | Book Swaps | MySQL2 threw `Bind parameters must not contain undefined` on `Swap.create`. | When `message` was omitted in swap creation, the query bind array passed an `undefined` value. | `server/models/Swap.js` | Added `message || null` fallback in bind parameters array. | **RESOLVED & VERIFIED** |
| **BUG-P17-008** | **P2** | Personalization | Missing `logActivity` helper in `recommendationService.js`. | Recommendation service lacked an exported function for programmatically logging browsing events into `user_activity`. | `server/services/recommendationService.js` | Implemented and exported `logActivity(userId, activityType, referenceId, metadata)` for real-time recommendation updates. | **RESOLVED & VERIFIED** |
| **BUG-P17-009** | **P1** | Authentication / UI | Google Sign-In button was missing on `/login` and `/register`, rendering a blank area below "OR CONTINUE WITH". | 1) `isConfigured` state lifecycle race kept container unrendered during initial mount; 2) GIS script loaded asynchronously without readiness polling; 3) `renderButton` was passed invalid option `width: '100%'` (Google requires integer pixel width max 400); 4) React children conflicted with GIS iframe DOM injection. | `client/src/components/GoogleSignInButton.jsx` | 1) Computed `isConfigured` synchronously; 2) Added GIS script polling loop (100ms, up to 6s); 3) Enforced valid pixel width (`Math.min(containerWidth, 400)`); 4) Made container an unmanaged leaf node with absolute overlay loading indicator and fallback retry button. | **RESOLVED & VERIFIED** |

---

## Verification Summary

All 9 identified defects were addressed in place without altering existing working business logic or modifying database records. The entire automated test suite (`server/test_phase17.js`) executes 47 end-to-end assertions with zero failures, and the Vite production client compiles with zero warnings or errors.

