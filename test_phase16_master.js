/**
 * Phase 16 Master End-to-End Regression & Verification Test Suite
 */

const { pool } = require('./server/config/db');
const AIService = require('./server/services/aiService');
const aiMarketplaceOperationsService = require('./server/services/aiMarketplaceOperationsService');
const recommendationService = require('./server/services/recommendationService');
const Book = require('./server/models/Book');
const Swap = require('./server/models/Swap');
const fs = require('fs');
const path = require('path');

async function runMasterRegression() {
    console.log('='.repeat(75));
    console.log(' BOOKNEST MARKETPLACE — PHASE 16 MASTER REGRESSION TEST SUITE');
    console.log('='.repeat(75));

    let passed = 0;
    let failed = 0;

    function verify(name, condition, note = '') {
        if (condition) {
            console.log(`[PASS] ${name}`);
            if (note) console.log(`       -> ${note}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name}`);
            if (note) console.error(`       -> ${note}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 1: PART 4 — BOOK COVER IMAGE INTEGRITY & BACKFILL
    // -------------------------------------------------------------------------
    console.log('\n--- Section 1: Book Cover Image Integrity ---');
    const [unsRows] = await pool.query("SELECT COUNT(*) as count FROM books WHERE cover_image LIKE '%unsplash%'");
    const [exRows] = await pool.query("SELECT COUNT(*) as count FROM books WHERE cover_image LIKE '%example.com%'");
    const [emptyRows] = await pool.query("SELECT COUNT(*) as count FROM books WHERE cover_image IS NULL OR cover_image = ''");
    const [totalRows] = await pool.query("SELECT COUNT(*) as count FROM books");
    const [validRows] = await pool.query("SELECT COUNT(*) as count FROM books WHERE cover_image IS NOT NULL AND cover_image != '' AND cover_image NOT LIKE '%unsplash%' AND cover_image NOT LIKE '%example.com%'");

    verify('Image Integrity: 0 Unsplash placeholder images in catalog', unsRows[0].count === 0, `Unsplash count: ${unsRows[0].count}`);
    verify('Image Integrity: 0 fake example.com URLs in catalog', exRows[0].count === 0, `Example.com count: ${exRows[0].count}`);
    verify('Image Integrity: 0 empty or null covers in catalog', emptyRows[0].count === 0, `Empty count: ${emptyRows[0].count}`);
    verify('Image Integrity: 100% catalog coverage with valid covers', validRows[0].count === totalRows[0].count && totalRows[0].count === 504, `Valid: ${validRows[0].count} / ${totalRows[0].count}`);

    const reportPath = path.resolve(__dirname, 'docs/unresolved_cover_matches.json');
    verify('Image Integrity: docs/unresolved_cover_matches.json exists', fs.existsSync(reportPath), 'Audit report logged on disk');

    // -------------------------------------------------------------------------
    // SECTION 2: PART 2 — CATEGORY-AWARE LISTING OPTIMIZER
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Category-Aware Listing Optimizer ---');
    const fictionOptimization = await aiMarketplaceOperationsService.optimizeListing(3, {
        title: 'It Ends with Us',
        author: 'Colleen Hoover',
        genre: 'Romance',
        price: 250,
        condition: 'Good'
    });

    const isFictionSafe = !fictionOptimization.suggestions.suggestedDescription.toLowerCase().includes('academic') &&
                          !fictionOptimization.suggestions.suggestedDescription.toLowerCase().includes('curriculum') &&
                          !fictionOptimization.suggestions.suggestedDescription.toLowerCase().includes('textbook') &&
                          !fictionOptimization.suggestions.suggestedDescription.toLowerCase().includes('booknest verified logistics');

    verify(
        'Listing AI: Colleen Hoover "It Ends with Us" classified as Fiction/Romance without academic claims',
        fictionOptimization.suggestions.categoryType === 'FICTION' && isFictionSafe,
        `Category: ${fictionOptimization.suggestions.categoryType} | Description: "${fictionOptimization.suggestions.suggestedDescription.slice(0, 75)}..."`
    );

    const academicOptimization = await aiMarketplaceOperationsService.optimizeListing(3, {
        title: 'NCERT Chemistry Class 11',
        author: 'NCERT Board',
        genre: 'NCERT',
        price: 180,
        condition: 'Good'
    });

    verify(
        'Listing AI: NCERT Chemistry classified as ACADEMIC with study keywords',
        academicOptimization.suggestions.categoryType === 'ACADEMIC' && academicOptimization.suggestions.searchKeywords.includes('ncert'),
        `Category: ${academicOptimization.suggestions.categoryType} | Keywords: ${academicOptimization.suggestions.searchKeywords.slice(0, 4).join(', ')}`
    );

    // -------------------------------------------------------------------------
    // SECTION 3: PART 3 — PRICING INSIGHT QUALITY & BENCHMARKS
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3: Pricing Insight Quality ---');
    const knownPriceInsight = await aiMarketplaceOperationsService.getPriceInsight(3, {
        title: 'Effective Java',
        category: 'Programming',
        condition: 'Good',
        currentPrice: 350
    });

    verify(
        'Pricing AI: Known title returns active vs sold breakdown and confidence',
        knownPriceInsight.status === 'SUCCESS' &&
        knownPriceInsight.confidence === 'HIGH' &&
        knownPriceInsight.activeCount > 0,
        `Active count: ${knownPriceInsight.activeCount} | Sold count: ${knownPriceInsight.soldCount} | Rec Range: ₹${knownPriceInsight.recommendedRange.minSuggested}-${knownPriceInsight.recommendedRange.maxSuggested}`
    );

    const unknownPriceInsight = await aiMarketplaceOperationsService.getPriceInsight(3, {
        title: 'Completely Unknown Title 1234567890',
        category: 'RareCollectibles',
        condition: 'Fair',
        currentPrice: 100
    });

    verify(
        'Pricing AI: Unknown title returns honest INSUFFICIENT_DATA with <= 2 comparables',
        unknownPriceInsight.status === 'INSUFFICIENT_DATA' &&
        unknownPriceInsight.message.includes('Not enough comparable listings to provide a reliable price recommendation'),
        `Status: ${unknownPriceInsight.status} | Confidence: ${unknownPriceInsight.confidence}`
    );

    // -------------------------------------------------------------------------
    // SECTION 4: PART 5 — REVIEW SUMMARY MESSAGING
    // -------------------------------------------------------------------------
    console.log('\n--- Section 4: Review Summary Messaging ---');
    const [noReviewBook] = await pool.query(`
        SELECT b.id, b.title 
        FROM books b 
        LEFT JOIN reviews r ON b.id = r.book_id 
        WHERE r.id IS NULL 
        LIMIT 1
    `);

    if (noReviewBook.length > 0) {
        const zeroReviewSummary = await aiMarketplaceOperationsService.summarizeReviews(noReviewBook[0].id);
        verify(
            'Review AI: 0 reviews returns status NO_REVIEWS and invitation to be first verified buyer',
            zeroReviewSummary.status === 'NO_REVIEWS' &&
            zeroReviewSummary.summary === 'No reviews yet. Be the first verified buyer to review this book.' &&
            zeroReviewSummary.reviewCount === 0,
            `Book ID ${noReviewBook[0].id}: "${zeroReviewSummary.summary}"`
        );
    }

    // -------------------------------------------------------------------------
    // SECTION 5: PART 6 — REAL-TIME PERSONALIZED RECOMMENDATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- Section 5: Personalized Recommendations ---');
    const guestRecs = await recommendationService.getPersonalizedRecommendations(null, 5, [7]); // viewed Fault in Our Stars (Romance)
    verify(
        'Recommendations: Guest browsing history immediately drives personalized recommendations',
        guestRecs.length > 0 && guestRecs.some(b => b.genre === 'Romance'),
        `Top guest recommendation: "${guestRecs[0]?.title}" in ${guestRecs[0]?.genre} (${guestRecs[0]?.reason})`
    );

    const coldRecs = await recommendationService.getPersonalizedRecommendations(null, 4, []);
    verify(
        'Recommendations: Cold start guest returns trending books without SQL errors',
        coldRecs.length > 0,
        `Returned ${coldRecs.length} trending items for first-time visitor`
    );

    // -------------------------------------------------------------------------
    // SECTION 6: PART 7 — SELLER LISTINGS & SWAP REQUESTS REPAIR
    // -------------------------------------------------------------------------
    console.log('\n--- Section 6: Seller Listings & Swap Architecture ---');
    // Verify Swap model handles active statuses and left joins
    const incomingSwaps = await Swap.findIncoming(3);
    const outgoingSwaps = await Swap.findOutgoing(3);
    verify(
        'Swaps: Swap.findIncoming and findOutgoing execute clean LEFT JOIN query without errors',
        Array.isArray(incomingSwaps) && Array.isArray(outgoingSwaps),
        `Retrieved ${incomingSwaps.length} incoming and ${outgoingSwaps.length} outgoing swap records for user 3`
    );

    // Verify Book.findByUserId executes clean query
    const sellerListings = await Book.findByUserId(3);
    verify(
        'Listings: Book.findByUserId executes clean query without errors',
        Array.isArray(sellerListings),
        `Retrieved ${sellerListings.length} listings for seller 3`
    );

    // -------------------------------------------------------------------------
    // SECTION 7: MASTER SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n' + '='.repeat(75));
    console.log(` MASTER REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(75));

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
}

runMasterRegression().catch(err => {
    console.error('Fatal master test error:', err);
    process.exit(1);
});
