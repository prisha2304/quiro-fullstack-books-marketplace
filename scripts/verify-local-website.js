const axios = require('E:/booknest_gpt_ag/server/node_modules/axios');

const API_BASE = 'http://localhost:5000/api';
const CLIENT_BASE = 'http://localhost:5173';

async function runVerification() {
  console.log('====================================================');
  console.log('🌐 BOOKNEST MARKETPLACE — LIVE LOCAL WEBSITE VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Frontend Server
  try {
    const res = await axios.get(CLIENT_BASE);
    assert(res.status === 200 && res.data.includes('<div id="root">'), 'Frontend SPA HTML served at http://localhost:5173');
  } catch (e) {
    assert(false, `Frontend server check failed: ${e.message}`);
  }

  // 2. Backend Health & Readiness
  try {
    const res = await axios.get(`${API_BASE}/health/ready`);
    assert(res.status === 200 && res.data.readiness === 'READY_FOR_TRAFFIC', 'Backend health probe ready for traffic');
  } catch (e) {
    assert(false, `Backend health check failed: ${e.message}`);
  }

  // 3. Category Taxonomy
  let categories = [];
  try {
    const res = await axios.get(`${API_BASE}/categories`);
    categories = res.data;
    assert(Array.isArray(categories) && categories.length > 0, `Catalog categories fetched (${categories.length} categories available)`);
  } catch (e) {
    assert(false, `Categories fetch failed: ${e.message}`);
  }

  // 4. Catalog Search & Books
  let sampleBook = null;
  try {
    const res = await axios.get(`${API_BASE}/search?query=&page=1&limit=10`);
    const results = res.data.results || res.data.books || res.data;
    assert(Array.isArray(results) && results.length > 0, `Search endpoint returns catalog results (${results.length} books on page 1)`);
    sampleBook = results[0];
  } catch (e) {
    assert(false, `Search endpoint failed: ${e.message}`);
  }

  // 5. Single Book Details
  if (sampleBook && sampleBook.id) {
    try {
      const res = await axios.get(`${API_BASE}/books/${sampleBook.id}`);
      const book = res.data;
      assert(book && (book.id === sampleBook.id || book.book?.id === sampleBook.id), `Book details retrieved for "${sampleBook.title || book.title || 'Book'}" (ID: ${sampleBook.id})`);
    } catch (e) {
      assert(false, `Book details failed: ${e.message}`);
    }
  }

  // 6. Buyer Authentication & Profile Fetch
  let buyerToken = null;
  let buyerProfile = null;
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      identifier: 'buyer@booknest.local',
      password: 'Password@123'
    });
    buyerToken = res.data.token;
    assert(buyerToken && (res.data.email === 'buyer@booknest.local' || res.data.username === 'local_buyer'), 'Buyer logged in successfully via /api/auth/login');
    
    // Check Profile
    const profRes = await axios.get(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${buyerToken}` } });
    buyerProfile = profRes.data;
    assert(buyerProfile && buyerProfile.email === 'buyer@booknest.local', 'Buyer profile verified (/api/auth/profile)');
  } catch (e) {
    assert(false, `Buyer login failed: ${e.message}`);
  }

  // 7. Seller Authentication
  let sellerToken = null;
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      identifier: 'seller@booknest.local',
      password: 'Password@123'
    });
    sellerToken = res.data.token;
    assert(sellerToken && (res.data.email === 'seller@booknest.local' || res.data.username === 'local_seller'), 'Seller logged in successfully via /api/auth/login');
  } catch (e) {
    assert(false, `Seller login failed: ${e.message}`);
  }

  // 8. Admin Authentication
  let adminToken = null;
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      identifier: 'admin@booknest.local',
      password: 'Password@123'
    });
    adminToken = res.data.token;
    const profRes = await axios.get(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(adminToken && profRes.data?.role === 'ADMIN', 'Admin authenticated with role ADMIN');
  } catch (e) {
    assert(false, `Admin login failed: ${e.message}`);
  }

  // 9. Buyer Wishlist Operations
  if (buyerToken && sampleBook) {
    const bookId = sampleBook.id;
    try {
      await axios.post(`${API_BASE}/wishlist/add`, { bookId }, { headers: { Authorization: `Bearer ${buyerToken}` } });
      const res = await axios.get(`${API_BASE}/wishlist`, { headers: { Authorization: `Bearer ${buyerToken}` } });
      assert(res.status === 200, `Buyer wishlist verified`);
    } catch (e) {
      assert(false, `Wishlist operation failed: ${e.message}`);
    }
  }

  // 10. Buyer Cart Operations
  if (buyerToken && sampleBook) {
    const bookId = sampleBook.id;
    try {
      await axios.post(`${API_BASE}/cart/${bookId}`, { quantity: 1 }, { headers: { Authorization: `Bearer ${buyerToken}` } });
      const res = await axios.get(`${API_BASE}/cart`, { headers: { Authorization: `Bearer ${buyerToken}` } });
      assert(res.status === 200, `Buyer cart verified`);
    } catch (e) {
      assert(false, `Cart operation failed: ${e.message}`);
    }
  }

  // 11. Admin Operations
  if (adminToken) {
    try {
      const res = await axios.get(`${API_BASE}/admin/operations/overview`, { headers: { Authorization: `Bearer ${adminToken}` } });
      assert(res.status === 200, 'Admin operations dashboard API accessible (/api/admin/operations/overview)');
    } catch (e) {
      assert(false, `Admin operations check failed: ${e.message}`);
    }
  }

  // 12. Recommendations Engine
  try {
    const res = await axios.get(`${API_BASE}/recommendations/suggestions`);
    assert(res.status === 200, 'Catalog suggestion recommendations operational');
  } catch (e) {
    assert(false, `Recommendations check failed: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 LIVE LOCAL VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed === 0) {
    console.log('🎉 LOCAL WEBSITE FULLY OPERATIONAL AND READY FOR BROWSER EXPLORATION!');
  }
}

runVerification();
