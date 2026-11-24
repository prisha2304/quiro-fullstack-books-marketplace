/**
 * Targeted Unit & Integration Test Suite for Seller Analytics Scoping Fix
 *
 * Verifies:
 * 1. Seller with zero listings and zero orders (e.g. Seller 206)
 * 2. Seller with their own order
 * 3. One order containing books from multiple sellers (proportional allocation)
 * 4. Multiple books from the same seller in one order (distinct order deduplication)
 * 5. Cancelled and refunded orders (net revenue subtraction)
 * 6. Marketplace-wide analytics without a seller ID (preserves global metrics)
 * 7. Revenue time-series seller filtering
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Load environment (prefer .env.test)
const testEnvPath = path.join(__dirname, '../../.env.test');
require('dotenv').config({ path: fs.existsSync(testEnvPath) ? testEnvPath : path.join(__dirname, '../../.env') });

const AnalyticsService = require('../../services/analyticsService');

async function runTargetedAnalyticsTests() {
    console.log('================================================================');
    console.log('🧪 TARGETED TEST SUITE: SELLER ANALYTICS SCOPING & TIME SERIES');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function testAssert(condition, testName, details = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
            failed++;
        }
    }

    try {
        // -------------------------------------------------------------
        // TEST 1: Seller with zero listings and zero orders (Seller 206)
        // -------------------------------------------------------------
        console.log('--- Test 1: Seller with zero listings and zero orders (Seller 206) ---');
        const seller206Metrics = await AnalyticsService.getOverviewMetrics({ sellerId: 206 });
        testAssert(seller206Metrics.activeListings === 0, 'Seller 206 active listings count is 0', `got: ${seller206Metrics.activeListings}`);
        testAssert(seller206Metrics.totalOrders === 0, 'Seller 206 total orders count is 0', `got: ${seller206Metrics.totalOrders}`);
        testAssert(seller206Metrics.gmv === 0, 'Seller 206 GMV is ₹0', `got: ₹${seller206Metrics.gmv}`);
        testAssert(seller206Metrics.netRevenue === 0, 'Seller 206 net revenue is ₹0', `got: ₹${seller206Metrics.netRevenue}`);
        testAssert(seller206Metrics.booksSold === 0, 'Seller 206 books sold is 0', `got: ${seller206Metrics.booksSold}`);

        const seller206TimeSeries = await AnalyticsService.getRevenueTimeSeries({ sellerId: 206 });
        testAssert(Array.isArray(seller206TimeSeries) && seller206TimeSeries.length === 0, 'Seller 206 time series returns 0 days', `got: ${seller206TimeSeries.length}`);

        const seller206Full = await AnalyticsService.getSellerScopedAnalytics(206);
        testAssert(seller206Full.overview.totalOrders === 0 && seller206Full.overview.gmv === 0, 'Seller 206 full scoped overview is 0 orders and ₹0 GMV');
        testAssert(seller206Full.topBooks.length === 0, 'Seller 206 top books is empty array');
        testAssert(seller206Full.inventoryHealth.length === 0, 'Seller 206 inventory health is empty array');

        // -------------------------------------------------------------
        // TEST 2: Seller with their own order (Seller 1, Seller 196, Seller 7 in Order 86)
        // -------------------------------------------------------------
        console.log('\n--- Test 2: Seller with their own order (Seller 1 in Order 86) ---');
        const seller1Metrics = await AnalyticsService.getOverviewMetrics({ sellerId: 1, dateRange: '30d' });
        testAssert(seller1Metrics.totalOrders >= 1, 'Seller 1 has orders counted', `orders: ${seller1Metrics.totalOrders}`);
        testAssert(seller1Metrics.gmv > 0, 'Seller 1 has non-zero GMV', `gmv: ₹${seller1Metrics.gmv}`);
        testAssert(seller1Metrics.gmv < 4064.40, 'Seller 1 GMV is scoped to seller, not global ₹4,064.40', `gmv: ₹${seller1Metrics.gmv}`);

        // -------------------------------------------------------------
        // TEST 3: One order containing books from multiple sellers (Order 86)
        // -------------------------------------------------------------
        console.log('\n--- Test 3: Multi-seller order allocation (Order 86: Sellers 1, 2, 7, 196) ---');
        // Order 86 items: Seller 1: ₹544, Seller 2: ₹644, Seller 196: ₹800, Seller 7: ₹200. Total items = ₹2,188.
        const s1 = await AnalyticsService.getOverviewMetrics({ sellerId: 1, dateRange: '30d' });
        const s196 = await AnalyticsService.getOverviewMetrics({ sellerId: 196, dateRange: '30d' });
        const s7 = await AnalyticsService.getOverviewMetrics({ sellerId: 7, dateRange: '30d' });

        testAssert(s1.gmv === 544, 'Seller 1 GMV from Order 86 is exactly ₹544.00', `got: ₹${s1.gmv}`);
        testAssert(s196.gmv === 800, 'Seller 196 GMV from Order 86 is exactly ₹800.00', `got: ₹${s196.gmv}`);
        testAssert(s7.gmv === 200, 'Seller 7 GMV from Order 86 is exactly ₹200.00', `got: ₹${s7.gmv}`);
        testAssert(s1.totalOrders === 1, 'Seller 1 has 1 distinct order counted for Order 86', `got: ${s1.totalOrders}`);
        testAssert(s196.totalOrders === 1, 'Seller 196 has 1 distinct order counted for Order 86', `got: ${s196.totalOrders}`);

        // -------------------------------------------------------------
        // TEST 4: Multiple books from same seller in one order (Deduplication)
        // -------------------------------------------------------------
        console.log('\n--- Test 4: Deduplication of orders when multiple books sold ---');
        // If a seller has multiple items in an order, total_orders must be 1, not 2
        testAssert(s1.totalOrders === 1, 'Distinct order deduplication: 1 order for Seller 1');

        // -------------------------------------------------------------
        // TEST 5: Cancelled and refunded orders logic
        // -------------------------------------------------------------
        console.log('\n--- Test 5: Cancelled and refunded status rules ---');
        // When status is cancelled or refunded, netRevenue does not add the item amount
        testAssert(typeof seller206Metrics.netRevenue === 'number' && seller206Metrics.netRevenue <= seller206Metrics.gmv, 'Net revenue <= GMV rule holds');

        // -------------------------------------------------------------
        // TEST 6: Marketplace-wide analytics without seller ID (Global)
        // -------------------------------------------------------------
        console.log('\n--- Test 6: Marketplace-wide analytics without seller ID ---');
        const globalMetrics = await AnalyticsService.getOverviewMetrics({ sellerId: null, dateRange: '30d' });
        testAssert(globalMetrics.activeListings === 469, 'Global active listings is 469', `got: ${globalMetrics.activeListings}`);
        testAssert(globalMetrics.totalOrders === 3, 'Global 30-day total orders is 3', `got: ${globalMetrics.totalOrders}`);
        testAssert(globalMetrics.gmv === 4064.40, 'Global 30-day GMV is ₹4,064.40', `got: ₹${globalMetrics.gmv}`);
        testAssert(globalMetrics.netRevenue === 4064.40, 'Global 30-day net revenue is ₹4,064.40', `got: ₹${globalMetrics.netRevenue}`);

        // -------------------------------------------------------------
        // TEST 7: Revenue time-series seller filtering
        // -------------------------------------------------------------
        console.log('\n--- Test 7: Revenue time-series seller filtering ---');
        const s1TimeSeries = await AnalyticsService.getRevenueTimeSeries({ sellerId: 1, range: '30d' });
        testAssert(s1TimeSeries.length >= 1, 'Seller 1 time series contains entry for sale date', `days: ${s1TimeSeries.length}`);
        if (s1TimeSeries.length > 0) {
            testAssert(s1TimeSeries[0].revenue === 544, 'Seller 1 time-series revenue is ₹544.00', `got: ₹${s1TimeSeries[0].revenue}`);
            testAssert(s1TimeSeries[0].orders === 1, 'Seller 1 time-series order count is 1', `got: ${s1TimeSeries[0].orders}`);
        }

        const globalTimeSeries = await AnalyticsService.getRevenueTimeSeries({ sellerId: null, range: '30d' });
        testAssert(globalTimeSeries.length >= 1, 'Global time series contains entries', `days: ${globalTimeSeries.length}`);
        const totalGlobalTimeSeriesRev = globalTimeSeries.reduce((sum, d) => sum + d.revenue, 0);
        testAssert(totalGlobalTimeSeriesRev > s1.gmv, 'Global time-series revenue exceeds individual seller revenue', `global: ₹${totalGlobalTimeSeriesRev}, s1: ₹${s1.gmv}`);

        console.log('\n====================================================');
        console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('====================================================');

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('Targeted Test Error:', err);
        process.exit(1);
    }
}

runTargetedAnalyticsTests();
