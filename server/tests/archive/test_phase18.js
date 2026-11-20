/**
 * Phase 18 Comprehensive Verification Test Suite
 * Brand: Fable & Folio
 * Tests:
 * 1. Database Integrity & Multi-Genre Taxonomy Expansion
 * 2. Multi-Field Search (Title, Author, ISBN, Publisher, Genre, Parent Category)
 * 3. Swap Marketplace Model & Service Methods (Discovery, Eligibility, Conflict Handling)
 * 4. Swap Enablement on Listing Creation
 * 5. Asset and Brand Integrity
 */

const { pool } = require('./config/db');
const Book = require('./models/Book');
const Category = require('./models/Category');
const Swap = require('./models/Swap');
const fs = require('fs');
const path = require('path');

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
        // ----------------------------------------------------
        // TEST SUITE 1: DATABASE INTEGRITY & TAXONOMY
        // ----------------------------------------------------
        console.log('--- Suite 1: Database Integrity & Category Taxonomy ---');
        
        // 1.1 Schema migration recorded
        const [migrations] = await pool.query(
            "SELECT * FROM schema_migrations WHERE migration_name = 'migrate_phase18'"
        );
        assert(migrations.length > 0, 'Phase 18 migration registered in schema_migrations');

        // 1.2 Total books count preserved
        const [bookCountRow] = await pool.query("SELECT COUNT(*) as total FROM books");
        const totalBooks = bookCountRow[0].total;
        assert(totalBooks >= 504, 'Catalog integrity: >= 504 books preserved', `Total books: ${totalBooks}`);

        // 1.3 Null genres check
        const [nullGenres] = await pool.query(
            "SELECT COUNT(*) as count FROM books WHERE genre IS NULL OR genre = ''"
        );
        assert(nullGenres[0].count === 0, 'No books have NULL or empty genre', `Count: ${nullGenres[0].count}`);

        // 1.4 Categories count expanded
        const [catCountRow] = await pool.query("SELECT COUNT(*) as total FROM categories");
        assert(catCountRow[0].total >= 40, 'Multi-genre taxonomy expanded', `Total categories: ${catCountRow[0].total}`);

        // 1.5 Category hierarchy grouping
        const grouped = await Category.findAllGrouped();
        const parentNames = Object.keys(grouped);
        assert(parentNames.length >= 8, 'Categories grouped by parent taxonomy', `Found ${parentNames.length} parent groups: ${parentNames.join(', ')}`);
        assert(parentNames.includes('Fiction'), 'Parent group Fiction exists');
        assert(parentNames.includes('Romance'), 'Parent group Romance exists');
        assert(parentNames.includes('Academic & Professional'), 'Parent group Academic & Professional exists');

        // ----------------------------------------------------
        // TEST SUITE 2: SEARCH & FILTERING CAPABILITIES
        // ----------------------------------------------------
        console.log('\n--- Suite 2: Search & Multi-Genre Discovery ---');

        // 2.1 Title search
        const titleRes = await Book.findAll({ search: 'Database' }, { limit: 5 });
        assert(titleRes.pagination?.total > 0 && titleRes.books.length > 0, 'Search by title works', `Found ${titleRes.pagination?.total} books for "Database"`);

        // 2.2 Author search
        const authorRes = await Book.findAll({ search: 'Silberschatz' }, { limit: 5 });
        assert(authorRes.pagination?.total > 0, 'Search by author works', `Found ${authorRes.pagination?.total} books for "Silberschatz"`);

        // 2.3 ISBN search
        const [sampleBook] = await pool.query("SELECT isbn FROM books WHERE isbn IS NOT NULL AND isbn != '' LIMIT 1");
        if (sampleBook.length > 0) {
            const isbnQuery = sampleBook[0].isbn;
            const isbnRes = await Book.findAll({ search: isbnQuery }, { limit: 5 });
            assert(isbnRes.pagination?.total > 0, 'Search by ISBN works', `Found ${isbnRes.pagination?.total} for ISBN ${isbnQuery}`);
        }

        // 2.4 Hierarchical Genre search (Parent Category expands to sub-genres)
        const academicRes = await Book.findAll({ genre: 'Academic & Professional' }, { limit: 5 });
        assert(academicRes.pagination?.total > 0, 'Hierarchical genre search resolves parent category to sub-genres', `Found ${academicRes.pagination?.total} books under Academic & Professional`);

        // 2.5 Empty search result fallback simulation
        const nonExistentRes = await Book.findAll({ search: 'XyZ123NonExistentBookQueryTitle999' }, { limit: 5 });
        assert(nonExistentRes.pagination?.total === 0, 'Non-existent search returns 0 matching results cleanly');

        // ----------------------------------------------------
        // TEST SUITE 3: SWAP MARKETPLACE LOGIC
        // ----------------------------------------------------
        console.log('\n--- Suite 3: Swap Marketplace Logic & Conflict Handling ---');

        // 3.1 Swap discoverable books query
        const [firstUser] = await pool.query("SELECT id FROM users LIMIT 1");
        const testUserId = firstUser[0].id;

        const discoverResult = await Swap.getDiscoverable(testUserId, { page: 1, limit: 10 });
        assert(discoverResult.books && Array.isArray(discoverResult.books), 'Swap.getDiscoverable returns array of books');
        assert(discoverResult.books.every(b => b.swap_enabled === 1 && b.status === 'available'), 'All discoverable swap books have swap_enabled = 1 and status = available');
        assert(discoverResult.books.every(b => b.seller_id !== testUserId), 'Discoverable swap books exclude requesting user listings');

        // 3.2 User eligible swap books query
        const eligibleBooks = await Swap.getUserSwapEligible(testUserId);
        assert(Array.isArray(eligibleBooks), 'Swap.getUserSwapEligible returns array of eligible books');
        assert(eligibleBooks.every(b => b.seller_id === testUserId && b.swap_enabled === 1), 'All eligible swap books belong to the user with swap_enabled = 1');

        // 3.3 Create test swap scenario and test conflict cancellation
        // Find two distinct users and their books
        const [usersWithBooks] = await pool.query(`
            SELECT b.id, b.seller_id, b.title 
            FROM books b 
            WHERE b.status = 'available' 
            LIMIT 2
        `);

        if (usersWithBooks.length >= 2 && usersWithBooks[0].seller_id !== usersWithBooks[1].seller_id) {
            const bookA = usersWithBooks[0];
            const bookB = usersWithBooks[1];
            const requesterId = bookA.seller_id;
            const targetOwnerId = bookB.seller_id;

            // Insert temporary test swap request
            const [insertReq] = await pool.query(`
                INSERT INTO swap_requests (requester_id, owner_id, requested_book_id, offered_book_id, status, message)
                VALUES (?, ?, ?, ?, 'pending', 'Automated test swap')
            `, [requesterId, targetOwnerId, bookB.id, bookA.id]);
            const testSwapId = insertReq.insertId;

            assert(testSwapId > 0, 'Test swap request successfully created in swap_requests', `ID: ${testSwapId}`);

            // Insert competing conflicting swap request for same bookB
            const [competingReq] = await pool.query(`
                INSERT INTO swap_requests (requester_id, owner_id, requested_book_id, offered_book_id, status, message)
                VALUES (?, ?, ?, ?, 'pending', 'Automated competing swap')
            `, [requesterId, targetOwnerId, bookB.id, bookA.id]);
            const competingSwapId = competingReq.insertId;

            // Update first swap to accepted using updateStatus (which auto-rejects other requests)
            await Swap.updateStatus(testSwapId, 'accepted');

            // Verify testSwapId is accepted
            const acceptedSwap = await Swap.findById(testSwapId);
            assert(acceptedSwap.status === 'accepted', 'Target swap status updated to accepted');

            // Verify competing request was automatically cancelled/rejected to prevent double-swaps
            const rejectedSwap = await Swap.findById(competingSwapId);
            assert(rejectedSwap.status === 'cancelled', 'Competing swap request automatically marked cancelled on acceptance');

            // Clean up test records and restore book status
            await pool.query("DELETE FROM swap_requests WHERE id IN (?, ?)", [testSwapId, competingSwapId]);
            await pool.query("UPDATE books SET status = 'available' WHERE id IN (?, ?)", [bookA.id, bookB.id]);
            console.log('  🧹 Cleaned up test swap records & restored book statuses successfully');
        } else {
            console.log('  ⚠️ Skipped swap conflict execution: need 2 distinct users with books');
        }

        // ----------------------------------------------------
        // TEST SUITE 4: SELL WORKFLOW & SWAP PERSISTENCE
        // ----------------------------------------------------
        console.log('\n--- Suite 4: Sell Book & Swap Enabled Persistence ---');

        const [sampleSeller] = await pool.query("SELECT id FROM users LIMIT 1");
        const sellerId = sampleSeller[0].id;

        // Insert test book with swap_enabled = 1
        const testBookId = await Book.create({
            title: 'Test Editorial Folio Volume',
            author: 'Test Literary Author',
            genre: 'Fiction',
            price: 299,
            condition: 'Like New',
            seller_id: sellerId,
            swap_enabled: 1,
            description: 'A test book for Phase 18 validation',
            stock: 1
        });

        assert(testBookId > 0, 'Book.create persists book with swap_enabled', `ID: ${testBookId}`);

        const fetchedBook = await Book.findById(testBookId);
        assert(fetchedBook.swap_enabled === 1, 'Book fetched has swap_enabled = 1');
        assert(fetchedBook.status === 'available', 'Book is marked available');

        // Delete test book
        await Book.delete(testBookId);
        console.log('  🧹 Cleaned up test book listing successfully');

        // ----------------------------------------------------
        // TEST SUITE 5: ASSET & BRAND INTEGRITY (QUIRO BRANDING)
        // ----------------------------------------------------
        console.log('\n--- Suite 5: Brand Assets & QUIRO Identity ---');

        const quiroLogoPath = path.join(__dirname, '../client/public/quiro-logo.png');
        assert(fs.existsSync(quiroLogoPath), 'Official QUIRO logo exists at client/public/quiro-logo.png');

        const heroImagePath = path.join(__dirname, '../client/public/hero-library.svg');
        assert(fs.existsSync(heroImagePath), 'Hero SVG illustration exists at client/public/hero-library.svg');

        const indexHtmlPath = path.join(__dirname, '../client/index.html');
        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        assert(indexHtml.includes('QUIRO'), 'client/index.html contains brand name "QUIRO"');
        assert(indexHtml.includes("Your Next Chapter Could Be Someone's First."), 'client/index.html contains official tagline');
        assert(!indexHtml.includes('Fable & Folio'), 'client/index.html no longer has "Fable & Folio"');
        assert(!indexHtml.includes('BookNest |'), 'client/index.html no longer has old "BookNest |" title');

        const indexCssPath = path.join(__dirname, '../client/src/index.css');
        const indexCss = fs.readFileSync(indexCssPath, 'utf8');
        assert(indexCss.includes('--color-primary: #35152F'), 'index.css defines --color-primary: #35152F (Deep Aubergine)');
        assert(indexCss.includes('--color-secondary: #DCE2E8'), 'index.css defines --color-secondary: #DCE2E8 (Ice Silver)');
        assert(indexCss.includes('--color-accent: #E5A323'), 'index.css defines --color-accent: #E5A323 (Marigold)');
        assert(indexCss.includes('--color-background: #FAF9F6'), 'index.css defines --color-background: #FAF9F6 (Soft Ivory)');

        console.log('\n====================================================');
        console.log(`🎉 TEST RUN COMPLETE: ${passed} Passed, ${failed} Failed`);
        console.log('====================================================\n');

    } catch (err) {
        console.error('Fatal error during test suite execution:', err);
    } finally {
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
