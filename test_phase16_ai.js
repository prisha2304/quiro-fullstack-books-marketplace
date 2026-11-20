/**
 * Phase 16 NestAI Conversation Quality & 10 Scenario Verification Script
 */

const { pool } = require('./server/config/db');
const AIService = require('./server/services/aiService');

async function runTests() {
    console.log('='.repeat(70));
    console.log(' PHASE 16: NESTAI CONVERSATIONAL QUALITY & 10-PROMPT VERIFICATION');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;

    // Helper for asserting
    function assert(name, condition, details = '') {
        if (condition) {
            console.log(`[PASS] ${name}`);
            if (details) console.log(`       -> ${details}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name}`);
            if (details) console.error(`       -> ${details}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // Prompt 1: Recommend books for someone who enjoys romantic fiction
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 1: Romance Recommendation ---');
    const p1 = await AIService.processUserQuery({
        message: 'Recommend books for someone who enjoys romantic fiction.'
    });
    console.log(`Intent: ${p1.intent} | Books: ${p1.recommendations.length} | Notice: ${p1.response.slice(0, 100)}...`);
    assert(
        'P1: Identifies Romance genre and returns catalog books',
        p1.intent === 'RECOMMEND' && p1.recommendations.length > 0 && p1.recommendations.some(b => b.genre === 'Romance'),
        `Returned ${p1.recommendations.length} Romance books (e.g. "${p1.recommendations[0]?.title}")`
    );

    // -------------------------------------------------------------------------
    // Prompt 2: Suggest beginner-friendly programming books under ₹500
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 2: Programming Under ₹500 ---');
    const p2 = await AIService.processUserQuery({
        message: 'Suggest beginner-friendly programming books under ₹500.'
    });
    console.log(`Intent: ${p2.intent} | MaxPrice: ${p2.filters.maxPrice} | Books: ${p2.recommendations.length}`);
    const allUnder500 = p2.recommendations.every(b => parseFloat(b.price) <= 500);
    assert(
        'P2: Filters programming books <= ₹500',
        p2.intent === 'RECOMMEND' && p2.recommendations.length > 0 && allUnder500 && p2.filters.genre === 'Programming',
        `Top book: "${p2.recommendations[0]?.title}" at ₹${p2.recommendations[0]?.price}`
    );

    // -------------------------------------------------------------------------
    // Prompt 3: What is the difference between these two books? (No context -> Clarification)
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 3: Comparison without prior context (Clarification) ---');
    const p3 = await AIService.processUserQuery({
        message: 'What is the difference between these two books?',
        context: []
    });
    console.log(`Intent: ${p3.intent} | Indicator: ${p3.context.contextIndicator}`);
    assert(
        'P3: Requests clarification when ambiguous without prior books in context',
        p3.intent === 'COMPARE_RECOMMENDATIONS' && p3.response.includes('Which two books') && p3.context.contextIndicator.includes('Clarification'),
        `Clarification text: "${p3.response.slice(0, 80)}..."`
    );

    // -------------------------------------------------------------------------
    // Prompt 4: Find books similar to It Ends with Us
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 4: Similar to "It Ends with Us" ---');
    const p4 = await AIService.processUserQuery({
        message: 'Find books similar to It Ends with Us.'
    });
    console.log(`Intent: ${p4.intent} | Indicator: ${p4.context.contextIndicator} | Books: ${p4.recommendations.length}`);
    assert(
        'P4: Discovers books similar to Colleen Hoover romance novel',
        p4.recommendations.length > 0 && p4.response.includes('It Ends with Us') && p4.recommendations.some(b => b.genre === 'Romance'),
        `Similar recommendations: ${p4.recommendations.map(b => `"${b.title}"`).join(', ')}`
    );

    // -------------------------------------------------------------------------
    // Prompt 5: Explain the difference between a new and a good-condition used book
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 5: Marketplace Condition Standards Guide ---');
    const p5 = await AIService.processUserQuery({
        message: 'Explain the difference between a new and a good-condition used book.'
    });
    console.log(`Intent: ${p5.intent} | Indicator: ${p5.context.contextIndicator}`);
    assert(
        'P5: Explains condition differences without catalog search failure',
        p5.intent === 'CONDITION_GUIDE' && p5.response.includes('Brand New') && p5.response.includes('Good') && p5.response.includes('Recommended Student Value'),
        `Returned comprehensive condition guide with student pricing guidance`
    );

    // -------------------------------------------------------------------------
    // Prompt 6: Can you recommend something different from the books I already viewed?
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 6: Diversity outside viewed books ---');
    const p6 = await AIService.processUserQuery({
        message: 'Can you recommend something different from the books I already viewed?',
        context: [
            { message: 'Recommend books for someone who enjoys romantic fiction', recommended_books: p1.recommendations }
        ]
    });
    console.log(`Intent: ${p6.intent} | Genres: ${p6.recommendations.map(b => b.genre).join(', ')}`);
    const isDifferent = p6.recommendations.every(b => b.genre !== 'Romance');
    assert(
        'P6: Recommends distinct genres outside viewed categories',
        p6.intent === 'EXPLORE_DIFFERENT' && p6.recommendations.length > 0 && isDifferent,
        `Diverse books found in: ${[...new Set(p6.recommendations.map(b => b.genre))].join(', ')}`
    );

    // -------------------------------------------------------------------------
    // Prompt 7: Compare the first recommendation with the second one
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 7: Compare first with second recommendation ---');
    const p7 = await AIService.processUserQuery({
        message: 'Compare the first recommendation with the second one.',
        context: [
            { message: 'Suggest beginner-friendly programming books under ₹500', recommended_books: p2.recommendations }
        ]
    });
    console.log(`Intent: ${p7.intent} | Comparison: ${p7.context.contextIndicator}`);
    assert(
        'P7: Compares 1st and 2nd recommendations from recent context',
        p7.intent === 'COMPARE_RECOMMENDATIONS' && p7.recommendations.length === 2 && p7.response.includes('Side-by-Side Comparison') && Boolean(p7.comparison),
        `Compared "${p7.recommendations[0]?.title}" vs "${p7.recommendations[1]?.title}"`
    );

    // -------------------------------------------------------------------------
    // Prompt 8: Unrelated or unsupported question
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 8: Unsupported Query (Out-of-Scope) ---');
    const p8 = await AIService.processUserQuery({
        message: 'What is the capital of France and how do I change a bicycle tire?'
    });
    console.log(`Intent: ${p8.intent} | Response: ${p8.response.slice(0, 90)}...`);
    assert(
        'P8: Polite scope boundary guidance for non-marketplace queries',
        p8.intent === 'UNSUPPORTED_QUERY' && p8.response.includes('outside the scope') && p8.recommendations.length === 0,
        `Politely states NestAI scope and redirects to book marketplace`
    );

    // -------------------------------------------------------------------------
    // Prompt 9: Follow-up question relying on previous conversation context
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 9: Context-aware follow-up ("Which one is cheaper?") ---');
    const p9 = await AIService.processUserQuery({
        message: 'Which one is cheaper?',
        context: [
            { message: 'Suggest beginner-friendly programming books under ₹500', recommended_books: p2.recommendations }
        ]
    });
    console.log(`Intent: ${p9.intent} | Indicator: ${p9.context.contextIndicator}`);
    assert(
        'P9: Identifies the lowest price book from previous context',
        p9.intent === 'FOLLOW_UP' && p9.recommendations.length === 1 && p9.response.includes('most budget-friendly'),
        `Cheapest identified: "${p9.recommendations[0]?.title}" at ₹${p9.recommendations[0]?.price}`
    );

    // -------------------------------------------------------------------------
    // Prompt 10: Private order request without authorization
    // -------------------------------------------------------------------------
    console.log('\n--- Prompt 10: Private order request without authorization ---');
    const p10Unauth = await AIService.processUserQuery({
        message: 'Show me the shipping address and phone number for order #102',
        userId: null // Unauthenticated guest
    });
    console.log(`Unauth Response: ${p10Unauth.response.slice(0, 80)}...`);
    assert(
        'P10A: Denies private order details for unauthenticated guest',
        p10Unauth.intent === 'ORDER_INQUIRY' && p10Unauth.response.includes('Authentication Required') && p10Unauth.action?.requiresAuth === true,
        `Successfully blocked unauthenticated access`
    );

    const p10WrongUser = await AIService.processUserQuery({
        message: 'Show me the shipping address and phone number for order #99999',
        userId: 3 // Existing user who does not own order #99999
    });
    console.log(`Wrong User Response: ${p10WrongUser.response.slice(0, 80)}...`);
    assert(
        'P10B: Denies access when order does not belong to user',
        p10WrongUser.intent === 'ORDER_INQUIRY' && p10WrongUser.response.includes('Access Denied'),
        `Successfully prevented cross-user order information leakage`
    );

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log(` NESTAI PROMPT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(70));

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
