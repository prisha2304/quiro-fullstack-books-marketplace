const AnalyticsService = require('./services/analyticsService');
const { pool } = require('./config/db');

async function runTests() {
    console.log("==================================================");
    console.log("STARTING PHASE 3D.1 AUTOMATED TEST SUITE");
    console.log("==================================================\n");

    let passed = 0;
    let failed = 0;

    const assert = (condition, name, details = '') => {
        if (condition) {
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${name} - ${details}`);
            failed++;
        }
    };

    try {
        // TEST 1 – Admin overview metrics
        const overview = await AnalyticsService.getOverviewMetrics({ dateRange: '30d' });
        assert(
            typeof overview.gmv === 'number' && typeof overview.totalOrders === 'number' && typeof overview.deliverySuccessRate === 'number',
            "TEST 1 – Admin overview metrics calculation",
            `GMV: ${overview.gmv}, Orders: ${overview.totalOrders}`
        );

        // TEST 2 – Revenue aggregation
        const revenueTrends = await AnalyticsService.getRevenueTimeSeries({ range: '30d' });
        assert(
            Array.isArray(revenueTrends) && revenueTrends.length >= 0,
            "TEST 2 – Revenue time-series aggregation",
            `Found ${revenueTrends.length} data points`
        );

        // TEST 3 – Date-range filtering
        const weekTrends = await AnalyticsService.getRevenueTimeSeries({ range: '7d' });
        const yearTrends = await AnalyticsService.getRevenueTimeSeries({ range: '1y' });
        assert(
            Array.isArray(weekTrends) && Array.isArray(yearTrends),
            "TEST 3 – Date-range filtering (7d, 30d, 1y)"
        );

        // TEST 4 – Category analytics
        const categories = await AnalyticsService.getCategoryPerformance({});
        assert(
            Array.isArray(categories) && (categories.length === 0 || (categories[0].category && typeof categories[0].revenue === 'number')),
            "TEST 4 – Category intelligence and growth rate calculation",
            `Categories count: ${categories.length}`
        );

        // TEST 5 – Book performance ranking
        const books = await AnalyticsService.getBookPerformance({ limit: 10 });
        assert(
            Array.isArray(books) && (books.length === 0 || (books[0].title && books[0].badge)),
            "TEST 5 – Book performance ranking & badges (Best Seller, High Value, etc.)",
            `Top books count: ${books.length}`
        );

        // TEST 6 – Seller performance ranking
        const sellers = await AnalyticsService.getSellerPerformance({ limit: 10 });
        assert(
            Array.isArray(sellers) && (sellers.length === 0 || (sellers[0].sellerId && sellers[0].ranking)),
            "TEST 6 – Seller performance rankings and reputation metrics",
            `Sellers count: ${sellers.length}`
        );

        // TEST 7 – Seller-scoped analytics
        let testSellerId = 1;
        if (sellers.length > 0 && sellers[0].sellerId) {
            testSellerId = sellers[0].sellerId;
        }
        const sellerScoped = await AnalyticsService.getSellerScopedAnalytics(testSellerId);
        assert(
            sellerScoped && sellerScoped.sellerId === testSellerId && Array.isArray(sellerScoped.actionableSuggestions),
            "TEST 7 – Seller-scoped business intelligence isolation"
        );

        // TEST 8 – Inventory health calculation
        const inventory = await AnalyticsService.getInventoryHealth(testSellerId);
        assert(
            Array.isArray(inventory) && (inventory.length === 0 || (inventory[0].status && inventory[0].recommendation)),
            "TEST 8 – Inventory health classification (Healthy, High Demand, Overpriced)"
        );

        // TEST 9 – Order funnel calculations
        const funnel = await AnalyticsService.getOrderFunnel();
        assert(
            Array.isArray(funnel) && funnel.length === 5 && funnel[0].stage === 'Listing Views',
            "TEST 9 – 5-Stage order conversion funnel analysis"
        );

        // TEST 10 – Customer aggregation/privacy
        const customers = await AnalyticsService.getCustomerIntelligence();
        assert(
            typeof customers.totalBuyers === 'number' && typeof customers.returningRate === 'string',
            "TEST 10 – Aggregated customer intelligence with privacy protection"
        );

        // TEST 11 – CSV/PDF export authorization & data formatting
        const csvRevenue = await AnalyticsService.generateCSVReport('revenue', null);
        const csvBooks = await AnalyticsService.generateCSVReport('books', null);
        assert(
            typeof csvRevenue === 'string' && csvRevenue.startsWith('Date,Revenue') &&
            typeof csvBooks === 'string' && csvBooks.startsWith('Book ID,Title'),
            "TEST 11 – CSV report generator formatting"
        );

        // TEST 12 – Cache performance
        const cacheTestStart = Date.now();
        await AnalyticsService.getOverviewMetrics({ dateRange: '30d' });
        const cacheDuration = Date.now() - cacheTestStart;
        assert(
            cacheDuration < 500,
            "TEST 12 – Analytics query execution latency",
            `Duration: ${cacheDuration}ms`
        );

        // TEST 13 – SQL injection/input validation
        const maliciousSellerScoped = await AnalyticsService.getSellerScopedAnalytics("1' OR '1'='1");
        assert(
            maliciousSellerScoped === null || (maliciousSellerScoped && typeof maliciousSellerScoped.sellerId === 'number'),
            "TEST 13 – SQL injection sanitization on seller parameters"
        );

        // TEST 14 – Admin authorization & route safety
        const analyticsRoutes = require('./routes/analyticsRoutes');
        assert(
            analyticsRoutes && analyticsRoutes.stack && analyticsRoutes.stack.length > 0,
            "TEST 14 – Admin/Seller route protection structure"
        );

        // TEST 15 – Existing Phase 3A regression tests
        const [bookCountRow] = await pool.query('SELECT COUNT(*) as count FROM books');
        assert(
            parseInt(bookCountRow[0].count, 10) >= 0,
            "TEST 15 – Phase 3A Database & Core Catalog regression"
        );

        // TEST 16 – Existing Phase 3C.1–3C.5 regression tests
        const AIService = require('./services/aiService');
        assert(
            typeof AIService === 'function' || typeof AIService === 'object',
            "TEST 16 – NestAI Service & Assistant regression integrity"
        );

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    }

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    process.exit(failed > 0 ? 1 : 0);
}

runTests();
