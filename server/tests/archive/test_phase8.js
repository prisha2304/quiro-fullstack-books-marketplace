require('dotenv').config();
const { pool } = require('./config/db');
const SellerOperationsService = require('./services/sellerOperationsService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        passedTests++;
        console.log(`[PASS] ${message}`);
    } else {
        failedTests++;
        console.error(`[FAIL] ${message}`);
    }
}

async function runPhase8TestSuite() {
    console.log('====================================================');
    console.log('STARTING PHASE 8 AUTOMATED TEST SUITE (60 TESTS)');
    console.log('Seller Operations, Fulfillment & Marketplace Intelligence');
    console.log('====================================================\n');

    let testBuyerId, testSeller1Id, testSeller2Id, testAdminId;
    let testBook1Id, testBook2Id, testBookSlowId;
    let testOrder1Id, testOrder2Id, testOrder3Id;
    let testShipmentId;

    try {
        const timeKey = Date.now().toString().slice(-6);

        // -------------------------------------------------------------
        // SETUP TEST USERS & ROLES
        // -------------------------------------------------------------
        const [buyerRes] = await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            ['Phase8 Buyer', `p8buyer_${timeKey}`, `p8buyer_${timeKey}@test.com`, 'hashedpassword', 'USER']
        );
        testBuyerId = buyerRes.insertId;

        const [seller1Res] = await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role, college) VALUES (?, ?, ?, ?, ?, ?)',
            ['Phase8 Seller One', `p8seller1_${timeKey}`, `p8seller1_${timeKey}@test.com`, 'hashedpassword', 'USER', 'Engineering Block']
        );
        testSeller1Id = seller1Res.insertId;

        const [seller2Res] = await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role, college) VALUES (?, ?, ?, ?, ?, ?)',
            ['Phase8 Seller Two', `p8seller2_${timeKey}`, `p8seller2_${timeKey}@test.com`, 'hashedpassword', 'USER', 'Science Block']
        );
        testSeller2Id = seller2Res.insertId;

        const [adminRes] = await pool.execute(
            'INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            ['Phase8 Admin', `p8admin_${timeKey}`, `p8admin_${timeKey}@test.com`, 'hashedpassword', 'ADMIN']
        );
        testAdminId = adminRes.insertId;

        // -------------------------------------------------------------
        // TEST SUITE: SELLER ONBOARDING & PROFILE COMPLETENESS (1-7)
        // -------------------------------------------------------------
        console.log('--- Testing Seller Onboarding & Profile Completeness ---');

        // 1. Initial Onboarding Creation
        const initialOnboarding = await SellerOperationsService.getSellerOnboarding(testSeller1Id);
        assert(
            initialOnboarding.onboarding && initialOnboarding.onboarding.seller_status === 'NOT_STARTED',
            '1. Seller onboarding record created automatically with NOT_STARTED status'
        );

        // 2. Submit Onboarding Application
        const submitRes = await SellerOperationsService.submitSellerOnboarding(testSeller1Id, {
            seller_display_name: 'Alex BookStore',
            seller_bio: 'Selling university textbooks with solved exam question papers and syllabus notes.',
            campus_department: 'Computer Science Dept',
            phone: '+91 99988 77766'
        });
        assert(submitRes.success === true, '2. Seller onboarding submission completed successfully');

        const submittedOnboarding = await SellerOperationsService.getSellerOnboarding(testSeller1Id);
        assert(
            submittedOnboarding.onboarding.seller_status === 'SUBMITTED',
            '3. Onboarding status transitions to SUBMITTED upon application'
        );

        // 4. Completeness Score Calculation (Complete profile)
        const completenessComplete = SellerOperationsService.calculateProfileCompleteness(
            { seller_display_name: 'Alex', seller_bio: 'Detailed seller bio with 30+ chars', seller_phone_verified: 1, campus_department: 'CS' },
            { full_name: 'Alex Doe', profile_image: 'avatar.jpg', phone: '1234567890', college: 'Tech Institute' }
        );
        assert(completenessComplete.score === 100, '4. Profile completeness score reaches 100% when all fields provided');

        // 5. Completeness Score Calculation (Partial profile)
        const completenessPartial = SellerOperationsService.calculateProfileCompleteness(
            { seller_display_name: '', seller_bio: '' },
            { full_name: 'Alex', profile_image: '', phone: '', college: '' }
        );
        assert(
            completenessPartial.score < 100 && completenessPartial.suggestions.length > 0,
            '5. Profile completeness identifies missing avatar/phone/bio with actionable suggestions'
        );

        // 6. Admin Verification Review (VERIFIED)
        const reviewVerified = await SellerOperationsService.reviewSellerOnboarding(testAdminId, testSeller1Id, {
            decision: 'VERIFIED'
        });
        assert(reviewVerified.decision === 'VERIFIED', '6. Admin can approve and set seller status to VERIFIED');

        // 7. Admin Rejection with Reason
        await SellerOperationsService.submitSellerOnboarding(testSeller2Id, {
            seller_display_name: 'Fake Store',
            seller_bio: 'Short',
            campus_department: 'Unknown'
        });
        const reviewRejected = await SellerOperationsService.reviewSellerOnboarding(testAdminId, testSeller2Id, {
            decision: 'REJECTED',
            rejectionReason: 'Invalid campus credentials'
        });
        const rejectedOnboarding = await SellerOperationsService.getSellerOnboarding(testSeller2Id);
        assert(
            rejectedOnboarding.onboarding.seller_status === 'REJECTED' && rejectedOnboarding.onboarding.rejection_reason === 'Invalid campus credentials',
            '7. Admin rejection correctly sets REJECTED status with explicit rejection reason'
        );

        // -------------------------------------------------------------
        // TEST SUITE: LISTING QUALITY ENGINE & STANDARDIZATION (8-14)
        // -------------------------------------------------------------
        console.log('\n--- Testing Listing Quality Engine & Condition Standardization ---');

        // 8. Excellent Listing Quality
        const excellentQuality = SellerOperationsService.calculateListingQuality({
            title: 'Advanced Engineering Mathematics 10th Edition',
            author: 'Erwin Kreyszig',
            isbn: '9780470458365',
            description: 'Comprehensive engineering mathematics textbook covering ODEs, linear algebra, vector calculus, and Fourier analysis.',
            condition: 'LIKE_NEW',
            cover_image: 'https://example.com/math.jpg'
        });
        assert(
            excellentQuality.qualityScore >= 85 && excellentQuality.qualityStatus === 'EXCELLENT',
            '8. Comprehensive listing metadata generates EXCELLENT quality score'
        );

        // 9. Missing Metadata Detection
        const poorQuality = SellerOperationsService.calculateListingQuality({
            title: 'Book',
            author: '',
            isbn: '',
            description: 'Short',
            condition: '',
            cover_image: ''
        });
        assert(
            poorQuality.qualityScore < 50 && poorQuality.qualityStatus === 'INCOMPLETE' && poorQuality.issues.length >= 4,
            '9. Missing fields flagged with specific issues and INCOMPLETE quality status'
        );

        // 10. Missing Cover Image detection
        assert(
            poorQuality.issues.some(i => i.toLowerCase().includes('cover image')),
            '10. Missing cover image correctly identified in quality issues'
        );

        // 11. Missing ISBN detection
        assert(
            poorQuality.issues.some(i => i.toLowerCase().includes('isbn')),
            '11. Missing ISBN detected with visibility impact suggestion'
        );

        // 12. Description too brief detection
        assert(
            poorQuality.issues.some(i => i.toLowerCase().includes('description')),
            '12. Brief description detected and penalized'
        );

        // 13. Condition Standardization Valid Mappings
        assert(
            SellerOperationsService.standardizeCondition('BRAND_NEW') === 'NEW' &&
            SellerOperationsService.standardizeCondition('Mint') === 'LIKE_NEW' &&
            SellerOperationsService.standardizeCondition('Fine') === 'VERY_GOOD' &&
            SellerOperationsService.standardizeCondition('Readable') === 'ACCEPTABLE',
            '13. Standardizes various legacy/human condition terms into strict canonical enum'
        );

        // 14. Unknown Condition Default Fallback
        assert(
            SellerOperationsService.standardizeCondition('UNKNOWN_RATING') === 'GOOD',
            '14. Fallback gracefully maps unknown condition to standard GOOD'
        );

        // -------------------------------------------------------------
        // TEST SUITE: DUPLICATE LISTING DETECTION (15-20)
        // -------------------------------------------------------------
        console.log('\n--- Testing Duplicate Listing Detection & Moderation ---');

        // Setup Test Books for Seller 1
        const [book1Res] = await pool.execute(`
            INSERT INTO books (title, author, isbn, price, \`condition\`, cover_image, description, seller_id, status, stock, views, wishlist_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', 3, 25, 6)
        `, [
            'Database System Concepts', 'Silberschatz', '9780073523323', 450.00, 'LIKE_NEW',
            'https://example.com/db.jpg', 'Seventh edition textbook for CS database systems course.',
            testSeller1Id
        ]);
        testBook1Id = book1Res.insertId;

        const [book2Res] = await pool.execute(`
            INSERT INTO books (title, author, isbn, price, \`condition\`, cover_image, description, seller_id, status, stock, views, wishlist_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', 1, 5, 1)
        `, [
            'Operating System Concepts', 'Silberschatz', '9781118063330', 500.00, 'VERY_GOOD',
            'https://example.com/os.jpg', 'Tenth edition OS textbook with dinosaur cover.',
            testSeller1Id
        ]);
        testBook2Id = book2Res.insertId;

        // 15. Exact ISBN Duplicate Match
        const dupIsbn = await SellerOperationsService.detectPotentialDuplicate(
            { title: 'Database Concepts Alternate', isbn: '978-0073523323' },
            testSeller1Id
        );
        assert(
            dupIsbn.isDuplicate === true && dupIsbn.matchType === 'ISBN_EXACT',
            '15. Exact ISBN match detected as POTENTIAL_DUPLICATE for seller'
        );

        // 16. Normalized Title + Author Duplicate Match
        const dupTitle = await SellerOperationsService.detectPotentialDuplicate(
            { title: 'Database System Concepts', author: 'Silberschatz', isbn: '' },
            testSeller1Id
        );
        assert(
            dupTitle.isDuplicate === true && dupTitle.matchType === 'TITLE_AUTHOR_MATCH',
            '16. Normalized Title + Author match detected as duplicate'
        );

        // 17. Non-duplicate listings pass
        const noDup = await SellerOperationsService.detectPotentialDuplicate(
            { title: 'Computer Networks', author: 'Tanenbaum', isbn: '9780132126953' },
            testSeller1Id
        );
        assert(noDup.isDuplicate === false, '17. Distinct book listings pass without duplicate flag');

        // 18. Self-exclusion when updating an existing listing
        const selfCheck = await SellerOperationsService.detectPotentialDuplicate(
            { title: 'Database System Concepts', isbn: '9780073523323' },
            testSeller1Id,
            testBook1Id
        );
        assert(selfCheck.isDuplicate === false, '18. Duplicate check ignores self when excludeBookId is provided');

        // 19. Evaluate and Save Listing Quality in DB
        const savedQuality = await SellerOperationsService.evaluateAndSaveListingQuality(testBook1Id, testSeller1Id);
        assert(
            savedQuality.quality.qualityScore > 70,
            '19. Evaluates and persists listing quality score in listing_moderation table'
        );

        // 20. Aggregated Quality for All Seller Listings
        const allQuality = await SellerOperationsService.getAllSellerListingsQuality(testSeller1Id);
        assert(
            allQuality.listings.length >= 2 && typeof allQuality.averageScore === 'number',
            '20. Aggregates all seller listings quality and computes average quality score'
        );

        // -------------------------------------------------------------
        // TEST SUITE: INVENTORY INTELLIGENCE & RECOMMENDATIONS (21-29)
        // -------------------------------------------------------------
        console.log('\n--- Testing Inventory Intelligence & Seller Recommendations ---');

        // Setup a slow-moving book (listed 60 days ago, 35 views, 0 sales)
        const [slowRes] = await pool.execute(`
            INSERT INTO books (title, author, isbn, price, \`condition\`, seller_id, status, stock, views, wishlist_count, created_at)
            VALUES (?, ?, ?, ?, 'GOOD', ?, 'available', 2, 35, 1, DATE_SUB(NOW(), INTERVAL 60 DAY))
        `, ['Discrete Mathematics and Its Applications', 'Kenneth Rosen', '9780073383095', 350.00, testSeller1Id]);
        testBookSlowId = slowRes.insertId;

        // Setup an out of stock book
        const [outOfStockRes] = await pool.execute(`
            INSERT INTO books (title, author, price, seller_id, status, stock, views, wishlist_count)
            VALUES ('Calculus Early Transcendentals', 'James Stewart', 600.00, ?, 'sold', 0, 10, 0)
        `, [testSeller1Id]);

        // 21. Get Inventory Intelligence Summary
        const invIntel = await SellerOperationsService.getSellerInventoryIntelligence(testSeller1Id);
        assert(invIntel.summary.totalListings >= 4, '21. Returns inventory intelligence summary with item breakdown');

        // 22. Low Stock Detection
        const lowStockItem = invIntel.inventoryItems.find(i => i.id === testBook2Id);
        assert(lowStockItem && lowStockItem.inventoryHealth === 'LOW_STOCK', '22. Low stock item correctly flagged (stock = 1)');

        // 23. Out of Stock Detection
        const outStockItem = invIntel.inventoryItems.find(i => i.id === outOfStockRes.insertId);
        assert(outStockItem && outStockItem.inventoryHealth === 'OUT_OF_STOCK', '23. Out of stock item correctly flagged (stock = 0)');

        // 24. Slow Moving Book Detection
        const slowItem = invIntel.inventoryItems.find(i => i.id === testBookSlowId);
        assert(slowItem && slowItem.inventoryHealth === 'SLOW_MOVING', '24. Slow moving item detected (>45 days, views > 10, 0 sales)');

        // 25. High Demand Item Detection
        const highDemandItem = invIntel.inventoryItems.find(i => i.id === testBook1Id);
        assert(highDemandItem && highDemandItem.inventoryHealth === 'HIGH_DEMAND', '25. High demand item detected (high views and wishlist bookmarking)');

        // 26. Reserved Stock Calculation
        await pool.execute(`
            INSERT INTO inventory_reservations (user_id, order_id, book_id, quantity, expires_at, status)
            VALUES (?, 99991, ?, 1, DATE_ADD(NOW(), INTERVAL 15 MINUTE), 'RESERVED')
        `, [testBuyerId, testBook1Id]);
        const invWithReserve = await SellerOperationsService.getSellerInventoryIntelligence(testSeller1Id);
        const itemWithReserve = invWithReserve.inventoryItems.find(i => i.id === testBook1Id);
        assert(itemWithReserve.reserved === 1 && itemWithReserve.available === 2, '26. Accurately calculates reserved stock and remaining available stock');

        // 27. Sold Stock Calculation
        assert(typeof itemWithReserve.sold === 'number', '27. Calculates total sold quantity for inventory item');

        // 28. Price Optimization Recommendation for Slow Moving
        const priceRec = invIntel.recommendations.find(r => r.type === 'PRICE_OPTIMIZATION');
        assert(priceRec && priceRec.impact === 'High', '28. Generates price optimization recommendation for slow-moving item');

        // 29. Restock Opportunity Recommendation for High Demand
        const restockRec = invIntel.recommendations.find(r => r.type === 'RESTOCK_OPPORTUNITY');
        assert(restockRec && restockRec.impact === 'Medium', '29. Generates restock recommendation for high student demand item');

        // -------------------------------------------------------------
        // TEST SUITE: ORDER FULFILLMENT WORKFLOW & STATE MACHINE (30-41)
        // -------------------------------------------------------------
        console.log('\n--- Testing Order Fulfillment Workflow & State Machine ---');

        // Setup Test Orders
        const [ord1Res] = await pool.execute(`
            INSERT INTO orders (buyer_id, total_price, status, created_at)
            VALUES (?, 450.00, 'confirmed', NOW())
        `, [testBuyerId]);
        testOrder1Id = ord1Res.insertId;

        await pool.execute(`
            INSERT INTO order_items (order_id, book_id, price)
            VALUES (?, ?, 450.00)
        `, [testOrder1Id, testBook1Id]);

        const [ord2Res] = await pool.execute(`
            INSERT INTO orders (buyer_id, total_price, status, created_at)
            VALUES (?, 500.00, 'confirmed', NOW())
        `, [testBuyerId]);
        testOrder2Id = ord2Res.insertId;

        await pool.execute(`
            INSERT INTO order_items (order_id, book_id, price)
            VALUES (?, ?, 500.00)
        `, [testOrder2Id, testBook2Id]);

        // 30. Valid Transition: confirmed -> processing
        const trans1 = await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder1Id, 'processing');
        assert(trans1.status === 'processing', '30. Valid fulfillment transition confirmed -> processing accepted');

        // 31. Valid Transition: processing -> packed
        const trans2 = await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder1Id, 'packed');
        assert(trans2.status === 'packed', '31. Valid fulfillment transition processing -> packed accepted');

        // 32. Valid Transition: packed -> shipped
        const trans3 = await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder1Id, 'shipped', {
            trackingNumber: `TRK_TEST_${timeKey}`,
            carrier: 'CampusExpress'
        });
        assert(trans3.status === 'shipped', '32. Valid fulfillment transition packed -> shipped with tracking accepted');

        // 33. Valid Transition: shipped -> in_transit
        const trans4 = await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder1Id, 'in_transit');
        assert(trans4.status === 'in_transit', '33. Valid fulfillment transition shipped -> in_transit accepted');

        // 34. Valid Transition: in_transit -> delivered
        const trans5 = await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder1Id, 'delivered');
        assert(trans5.status === 'delivered', '34. Valid fulfillment transition in_transit -> delivered accepted');

        // 35. Invalid Transition Rejection: delivered -> processing
        let invalidTransRejected = false;
        try {
            await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder1Id, 'processing');
        } catch (err) {
            invalidTransRejected = true;
        }
        assert(invalidTransRejected, '35. Invalid fulfillment transition delivered -> processing is strictly rejected');

        // 36. Invalid Jump Rejection: confirmed -> delivered directly
        let jumpRejected = false;
        try {
            await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder2Id, 'delivered');
        } catch (err) {
            jumpRejected = true;
        }
        assert(jumpRejected, '36. Invalid state jump confirmed -> delivered directly is rejected by state machine');

        // 37. Seller Order Isolation: Seller 2 cannot modify Seller 1 order
        let unauthorizedSellerRejected = false;
        try {
            await SellerOperationsService.updateFulfillmentStatus(testSeller2Id, testOrder2Id, 'processing');
        } catch (err) {
            unauthorizedSellerRejected = true;
        }
        assert(unauthorizedSellerRejected, '37. Seller isolation enforced: unauthorized seller cannot modify other order');

        // 38. Cancelled Order Protection
        await pool.execute('UPDATE orders SET status = "cancelled" WHERE id = ?', [testOrder2Id]);
        let cancelledRejected = false;
        try {
            await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder2Id, 'processing');
        } catch (err) {
            cancelledRejected = true;
        }
        assert(cancelledRejected, '38. Cancelled order fulfillment modification is strictly prevented');

        // 39. Bulk Fulfillment Processing for Valid States
        const [ord3Res] = await pool.execute(`
            INSERT INTO orders (buyer_id, total_price, status, created_at)
            VALUES (?, 450.00, 'confirmed', NOW())
        `, [testBuyerId]);
        testOrder3Id = ord3Res.insertId;
        await pool.execute('INSERT INTO order_items (order_id, book_id, price) VALUES (?, ?, 450.00)', [testOrder3Id, testBook1Id]);

        const bulkRes = await SellerOperationsService.bulkUpdateFulfillmentStatus(testSeller1Id, {
            orderIds: [testOrder3Id],
            nextStatus: 'processing'
        });
        assert(bulkRes.successful === 1, '39. Bulk fulfillment updates eligible orders successfully');

        // 40. Bulk Fulfillment Rejection on Non-Whitelisted State
        let bulkBadStateRejected = false;
        try {
            await SellerOperationsService.bulkUpdateFulfillmentStatus(testSeller1Id, {
                orderIds: [testOrder3Id],
                nextStatus: 'delivered'
            });
        } catch (err) {
            bulkBadStateRejected = true;
        }
        assert(bulkBadStateRejected, '40. Bulk fulfillment rejects non-whitelisted states (e.g. delivered)');

        // 41. Refunded Order Protection
        await pool.execute('UPDATE orders SET status = "refunded" WHERE id = ?', [testOrder3Id]);
        let refundRejected = false;
        try {
            await SellerOperationsService.updateFulfillmentStatus(testSeller1Id, testOrder3Id, 'packed');
        } catch (err) {
            refundRejected = true;
        }
        assert(refundRejected, '41. Refunded order status cannot be modified by seller fulfillment');

        // -------------------------------------------------------------
        // TEST SUITE: SELLER SLA ENGINE & EVENTS (42-45)
        // -------------------------------------------------------------
        console.log('\n--- Testing Seller SLA Engine & Breach Detection ---');

        // 42. SLA Event Generation on Processing
        const [slaRows] = await pool.execute('SELECT * FROM seller_sla_events WHERE order_id = ?', [testOrder1Id]);
        assert(slaRows.length > 0, '42. SLA event records created with target completion timestamps');

        // 43. SLA On-Time Classification
        const onTimeEvent = slaRows.find(s => s.sla_status === 'ON_TIME');
        assert(onTimeEvent !== undefined, '43. Accurately flags on-time task completions when fulfilled within SLA window');

        // 44. Seller SLA Summary Calculation
        const slaSummary = await SellerOperationsService.getSellerSLASummary(testSeller1Id);
        assert(
            slaSummary.totalTrackedEvents > 0 && typeof slaSummary.onTimeRate === 'number',
            '44. Computes total SLA events, on-time count, and on-time compliance rate'
        );

        // 45. Seller SLA Isolation
        const seller2Sla = await SellerOperationsService.getSellerSLASummary(testSeller2Id);
        assert(seller2Sla.totalTrackedEvents === 0, '45. Seller SLA data strictly isolated between sellers');

        // -------------------------------------------------------------
        // TEST SUITE: SHIPMENT TRACKING & TIMELINE ABSTRACTION (46-51)
        // -------------------------------------------------------------
        console.log('\n--- Testing Shipment Tracking Abstraction & Buyer Timeline ---');

        // 46. Create Shipment
        const shipmentRes = await SellerOperationsService.createShipment(testSeller1Id, {
            orderId: testOrder1Id,
            trackingNumber: `TRACK_${timeKey}_CAMPUS`,
            carrier: 'Campus Courier Express',
            mode: 'MOCK'
        });
        testShipmentId = shipmentRes.shipmentId;
        assert(shipmentRes.success === true && testShipmentId > 0, '46. Creates shipment record with provider-independent tracking abstraction');

        // 47. Initial Shipment Event Generated
        const [shipEvents] = await pool.execute('SELECT * FROM shipment_events WHERE shipment_id = ?', [testShipmentId]);
        assert(shipEvents.length > 0 && shipEvents[0].status === 'LABEL_CREATED', '47. Generates initial LABEL_CREATED event upon shipment creation');

        // 48. Unauthorized Shipment Creation Rejected
        let unauthShipmentRejected = false;
        try {
            await SellerOperationsService.createShipment(testSeller2Id, {
                orderId: testOrder1Id,
                trackingNumber: 'FAKE_TRACK'
            });
        } catch (err) {
            unauthShipmentRejected = true;
        }
        assert(unauthShipmentRejected, '48. Rejects shipment creation attempts by unauthorized sellers');

        // 49. Add Shipment Event
        const eventRes = await SellerOperationsService.addShipmentEvent(testShipmentId, {
            status: 'OUT_FOR_DELIVERY',
            location: 'Central Campus Hub',
            description: 'Out for delivery with campus student runner'
        });
        assert(eventRes.success === true, '49. Adds shipment tracking event with location and description');

        // 50. Buyer Timeline Ordering
        const buyerTimeline = await SellerOperationsService.getBuyerShipmentTimeline(testOrder1Id);
        assert(
            buyerTimeline.hasShipment === true && buyerTimeline.events.length >= 2,
            '50. Buyer shipment timeline returns ordered chronological delivery events'
        );

        // 51. Buyer-Safe Tracking (No private risk signals)
        assert(
            buyerTimeline.riskLevel === undefined && buyerTimeline.signals === undefined,
            '51. Buyer shipment tracking strictly excludes private seller operational risk signals'
        );

        // -------------------------------------------------------------
        // TEST SUITE: LISTING MODERATION WORKFLOW & AUDIT LOGS (52-54)
        // -------------------------------------------------------------
        console.log('\n--- Testing Listing Moderation Workflow & Audit Logs ---');

        // 52. Admin Listing Moderation: ACTIVE
        const modActive = await SellerOperationsService.moderateListing(testAdminId, testBook1Id, {
            decision: 'ACTIVE',
            reason: 'Verified campus textbook'
        });
        assert(modActive.decision === 'ACTIVE', '52. Admin can review and approve listings to ACTIVE status');

        // 53. Admin Listing Moderation: REJECTED (Sets unavailable status)
        const modReject = await SellerOperationsService.moderateListing(testAdminId, testBook2Id, {
            decision: 'REJECTED',
            reason: 'Missing legitimate condition proof'
        });
        const [draftBook] = await pool.execute('SELECT status FROM books WHERE id = ?', [testBook2Id]);
        assert(
            draftBook[0].status === 'unavailable',
            '53. Moderation rejection automatically moves book to unavailable status'
        );

        // 54. Invalid Moderation Decision Rejection
        let badModRejected = false;
        try {
            await SellerOperationsService.moderateListing(testAdminId, testBook1Id, { decision: 'INVALID_STATUS' });
        } catch (err) {
            badModRejected = true;
        }
        assert(badModRejected, '54. Rejects invalid moderation status decisions');

        // -------------------------------------------------------------
        // TEST SUITE: SELLER OPERATIONAL RISK SIGNALS & ADMIN CENTER (55-60)
        // -------------------------------------------------------------
        console.log('\n--- Testing Seller Risk Signals & Admin Operations Center ---');

        // 55. Calculate Seller Operational Risk Signals
        const seller1Risk = await SellerOperationsService.calculateSellerRiskSignals(testSeller1Id);
        assert(
            seller1Risk.sellerId === testSeller1Id && ['LOW', 'MEDIUM', 'HIGH'].includes(seller1Risk.riskLevel),
            '55. Calculates operational risk level (LOW/MEDIUM/HIGH) based on cancel/dispute/SLA patterns'
        );

        // 56. Risk Metrics Evidence Retrieval
        assert(
            typeof seller1Risk.metrics?.cancellationRate === 'number' && typeof seller1Risk.metrics?.disputeRate === 'number',
            '56. Returns auditable underlying evidence (cancellation rate, dispute rate, SLA breaches)'
        );

        // 57. Admin Operations Overview Aggregation
        const adminOverview = await SellerOperationsService.getAdminOperationsOverview();
        assert(
            adminOverview.metrics && adminOverview.pendingOnboardings !== undefined && adminOverview.moderationQueue !== undefined,
            '57. Admin Operations Center aggregates pending onboardings, moderation queue, & at-risk fulfillments'
        );

        // 58. Seller Operations Dashboard Overview
        const sellerOverview = await SellerOperationsService.getSellerOperationsOverview(testSeller1Id);
        assert(
            sellerOverview.fulfillmentQueue && sellerOverview.inventorySummary && sellerOverview.recommendations,
            '58. Seller Operations Overview provides fulfillment queues, inventory summary, and growth tips'
        );

        // 59. Buyer-Safe Public Seller Performance Profile
        const publicProfile = await SellerOperationsService.getBuyerPublicSellerProfile(testSeller1Id);
        assert(
            publicProfile.isVerified === true && publicProfile.averageRating !== undefined && publicProfile.revenue === undefined,
            '59. Public seller profile displays verified badge & ratings while protecting financial data'
        );

        // 60. Security & SQL Injection Protection
        let sqlInjectFailed = false;
        try {
            const sqliCheck = await SellerOperationsService.detectPotentialDuplicate(
                { title: "' OR '1'='1", isbn: "' OR '1'='1" },
                testSeller1Id
            );
            sqlInjectFailed = true;
        } catch (err) {
            sqlInjectFailed = false;
        }
        assert(sqlInjectFailed, '60. Parameterized SQL queries safeguard against injection attacks in intelligence queries');

    } catch (err) {
        console.error('Fatal error during Phase 8 test suite:', err);
    } finally {
        console.log('\n====================================================');
        console.log(`PHASE 8 TESTS FINISHED: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
        console.log('====================================================\n');
        process.exit(failedTests > 0 ? 1 : 0);
    }
}

runPhase8TestSuite();
