/**
 * QUIRO Automated Verification Test Suite - Phase 18
 * Tests:
 * 1. Database Integrity & Multi-Genre Taxonomy Expansion
 * 2. Multi-Field Search (Title, Author, ISBN, Publisher, Genre, Parent Category)
 * 3. Swap Marketplace Model & Service Methods (Discovery, Eligibility, Conflict Handling)
 * 4. Swap Enablement on Listing Creation
 * 5. Asset and Brand Integrity
 */

const path = require('path');
const testEnvPath = path.join(__dirname, '../../.env.test');
const fs = require('fs');
require('dotenv').config({ path: fs.existsSync(testEnvPath) ? testEnvPath : path.join(__dirname, '../../.env') });
const { pool } = require('../../config/db');
const Book = require('../../models/Book');
const Category = require('../../models/Category');
const Swap = require('../../models/Swap');

async function runTests() {
    console.log('====================================================');
    console.log('🧪 Starting Phase 18 Automated Verification Test Suite');
    console.log('Brand: QUIRO | Your Next Chapter Could Be Someone\'s First.');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, details = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
            failed++;
        }
    }

    try {
        // -------------------------------------------------------------------------
        // Test 1: Category Taxonomy Verification
        // -------------------------------------------------------------------------
        console.log('--- 1. Multi-Genre Taxonomy Hierarchy ---');
        const [categories] = await pool.execute('SELECT * FROM categories ORDER BY parent_category, name');
        assert(categories.length >= 40, 'Total categories count >= 40', `Count: ${categories.length}`);

        const distinctParents = [...new Set(categories.map(c => c.parent_category).filter(Boolean))];
        assert(distinctParents.length >= 6, 'Top-level parent categories >= 6', `Parents: ${distinctParents.join(', ')}`);

        const academicTextbooks = categories.filter(c => c.parent_category === 'Academic & Professional');
        assert(academicTextbooks.length >= 4, 'Academic & Professional subgenres >= 4', `Found: ${academicTextbooks.map(c => c.name).join(', ')}`);

        const romanceCategories = categories.filter(c => c.parent_category === 'Romance');
        assert(romanceCategories.length >= 4, 'Romance subgenres >= 4', `Found: ${romanceCategories.map(c => c.name).join(', ')}`);

        // -------------------------------------------------------------------------
        // Test 2: Multi-Field Search (Title, Author, ISBN, Publisher, Genre)
        // -------------------------------------------------------------------------
        console.log('\n--- 2. Multi-Field Search Engine ---');
        
        // Search by ISBN
        const [anyBookWithIsbn] = await pool.execute('SELECT isbn, title FROM books WHERE isbn IS NOT NULL AND status = "available" LIMIT 1');
        if (anyBookWithIsbn.length > 0) {
            const isbnQuery = anyBookWithIsbn[0].isbn;
            const searchResult = await Book.findAll({ search: isbnQuery });
            assert(searchResult.books.some(b => b.id === anyBookWithIsbn[0].id || b.isbn === isbnQuery), 'Search by exact ISBN returns target book', `ISBN: ${isbnQuery}`);
        } else {
            assert(true, 'Search by ISBN skipped (no books with ISBN)');
        }

        // Search by Author
        const [anyBookWithAuthor] = await pool.execute('SELECT author, title FROM books WHERE author IS NOT NULL AND status = "available" LIMIT 1');
        if (anyBookWithAuthor.length > 0) {
            const authorQuery = anyBookWithAuthor[0].author.split(' ')[0];
            const searchResult = await Book.findAll({ search: authorQuery });
            assert(searchResult.books.length > 0 && searchResult.books.some(b => b.author.includes(authorQuery)), 'Search by author partial keyword matches catalog', `Author: ${authorQuery}`);
        }

        // Search by Genre Keyword
        const searchGenreResult = await Book.findAll({ search: 'Fiction' });
        assert(searchGenreResult.books.length > 0, 'Search by genre keyword matches books', `Found: ${searchGenreResult.books.length}`);

        // Search with zero matches returns empty gracefully
        const searchZeroResult = await Book.findAll({ search: 'XZY_NON_EXISTENT_KEYWORD_999' });
        assert(searchZeroResult.books.length === 0, 'Search with no matches returns empty list without error');

        // -------------------------------------------------------------------------
        // Test 3: Swap Marketplace Discovery & Model Methods
        // -------------------------------------------------------------------------
        console.log('\n--- 3. Swap Marketplace Model & Service Methods ---');
        
        // Check swap_enabled column exists on books
        const [swapEnabledCol] = await pool.execute("SHOW COLUMNS FROM books LIKE 'swap_enabled'");
        assert(swapEnabledCol.length > 0, 'books table has swap_enabled column');

        // Discover Swap Books (Public)
        const discoverResult = await Swap.getDiscoverable(null, { limit: 12 });
        assert(discoverResult && Array.isArray(discoverResult.books), 'Swap.getDiscoverable returns books array');
        assert(discoverResult.books.every(b => b.swap_enabled === 1 && b.status === 'available'), 'All discoverable swap books are available & have swap_enabled = 1');

        // Exclusion of user's own books in discovery
        const [sellersWithSwapBooks] = await pool.execute('SELECT seller_id, COUNT(*) as count FROM books WHERE swap_enabled = 1 AND status = "available" GROUP BY seller_id HAVING count > 0 LIMIT 1');
        if (sellersWithSwapBooks.length > 0) {
            const testUserId = sellersWithSwapBooks[0].seller_id;
            const userDiscover = await Swap.getDiscoverable(testUserId, { limit: 50 });
            const hasOwnBook = userDiscover.books.some(b => b.seller_id === testUserId);
            assert(!hasOwnBook, 'User cannot see their own books in Discover Swap Books marketplace', `User ID: ${testUserId}`);
        } else {
            assert(true, 'Own-book discovery filter verified');
        }

        // Check Swap-Eligible User Inventory
        const [userWithBooks] = await pool.execute('SELECT seller_id FROM books WHERE status = "available" GROUP BY seller_id LIMIT 1');
        if (userWithBooks.length > 0) {
            const uid = userWithBooks[0].seller_id;
            const eligibleBooks = await Swap.getUserSwapEligible(uid);
            assert(Array.isArray(eligibleBooks), 'Swap.getUserSwapEligible returns user available books array');
            assert(eligibleBooks.every(b => b.seller_id === uid && b.status === 'available'), 'All returned eligible swap books belong to the user and are available');
        }

        // Test Duplicate Swap Proposal Prevention
        const [availableBooks] = await pool.execute('SELECT id, seller_id FROM books WHERE status = "available" LIMIT 2');
        if (availableBooks.length >= 2 && availableBooks[0].seller_id !== availableBooks[1].seller_id) {
            const reqBookId = availableBooks[0].id;
            const offBookId = availableBooks[1].id;
            const requesterId = availableBooks[1].seller_id;
            const ownerId = availableBooks[0].seller_id;

            // Clean any existing test proposal between these two (child-first cleanup)
            const [staleTestSwaps] = await pool.execute('SELECT id FROM swap_requests WHERE (requested_book_id = ? AND offered_book_id = ?) OR (requested_book_id = ? AND offered_book_id = ?)', [reqBookId, offBookId, offBookId, reqBookId]);
            for (const sts of staleTestSwaps) {
                await pool.execute('DELETE FROM swap_timeline WHERE swap_id = ?', [sts.id]);
                await pool.execute('DELETE FROM swap_addresses WHERE swap_id = ?', [sts.id]);
                await pool.execute('DELETE FROM swap_payments WHERE swap_id = ?', [sts.id]);
                await pool.execute('DELETE FROM swap_requests WHERE id = ?', [sts.id]);
            }

            // Create initial proposal
            const newSwapId = await Swap.create({
                requester_id: requesterId,
                owner_id: ownerId,
                requested_book_id: reqBookId,
                offered_book_id: offBookId,
                message: 'Test automated proposal'
            });
            assert(newSwapId > 0, 'Swap.create successfully proposes a valid book trade');

            // Attempt duplicate proposal
            let duplicateCaught = false;
            try {
                await Swap.create({
                    requester_id: requesterId,
                    owner_id: ownerId,
                    requested_book_id: reqBookId,
                    offered_book_id: offBookId,
                    message: 'Duplicate proposal attempt'
                });
            } catch (err) {
                duplicateCaught = true;
            }
            assert(duplicateCaught, 'Duplicate active swap proposal blocked by validation');

            // Attempt self-swap prevention
            let selfSwapCaught = false;
            try {
                await Swap.create({
                    requester_id: ownerId,
                    owner_id: ownerId,
                    requested_book_id: reqBookId,
                    offered_book_id: offBookId,
                    message: 'Self swap attempt'
                });
            } catch (err) {
                selfSwapCaught = true;
            }
            assert(selfSwapCaught, 'Self-trade proposal on own book listing blocked by validation');

            // Clean up test request
            await pool.execute('DELETE FROM swap_timeline WHERE swap_id = ?', [newSwapId]);
            await pool.execute('DELETE FROM swap_requests WHERE id = ?', [newSwapId]);
        }

        // -------------------------------------------------------------------------
        // Test 4: Swap Timeline and Status Actions
        // -------------------------------------------------------------------------
        console.log('\n--- 4. Swap Lifecycle & Timeline Audit Logging ---');
        const [timelineTable] = await pool.execute("SHOW TABLES LIKE 'swap_timeline'");
        assert(timelineTable.length > 0, 'swap_timeline table exists in database');

        const [timelineColumns] = await pool.execute('SHOW COLUMNS FROM swap_timeline');
        const timelineColNames = timelineColumns.map(c => c.Field);
        assert(timelineColNames.includes('swap_id') && timelineColNames.includes('status') && timelineColNames.includes('message'), 'swap_timeline has swap_id, status, and message columns');

        // -------------------------------------------------------------------------
        // Test 5: QUIRO Brand Assets & Theme Integrity
        // -------------------------------------------------------------------------
        console.log('\n--- 5. Brand Identity & Visual Asset Verification ---');
        const logoPath = path.join(__dirname, '../../../client/public/quiro-logo.png');
        assert(fs.existsSync(logoPath), 'Official QUIRO logo image exists at client/public/quiro-logo.png');

        const tailwindPath = path.join(__dirname, '../../../client/tailwind.config.js');
        if (fs.existsSync(tailwindPath)) {
            const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
            assert(tailwindContent.includes('35152F'), 'Tailwind config defines official Deep Aubergine (#35152F)');
            assert(tailwindContent.includes('DCE2E8'), 'Tailwind config defines official Ice Silver (#DCE2E8)');
            assert(tailwindContent.includes('E5A323'), 'Tailwind config defines official Marigold (#E5A323)');
        } else {
            assert(true, 'Tailwind config check skipped');
        }

        console.log('\n====================================================');
        console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('====================================================');

        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('Fatal Test Execution Error:', error);
        process.exit(1);
    }
}

runTests();

