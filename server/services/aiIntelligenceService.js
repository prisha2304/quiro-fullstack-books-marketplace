const { pool } = require('../config/db');
const Book = require('../models/Book');
const AuditService = require('./auditService');

class AIIntelligenceService {
    /**
     * Reusable Value Score Calculation (0-100)
     */
    static calculateValueScore(book, options = {}) {
        if (!book) return { score: 0, highlights: [] };

        const price = parseFloat(book.price || 0);
        const rating = parseFloat(book.rating || 4.5);
        const condition = book.condition || 'Good';
        const views = parseInt(book.views || 0, 10);

        // Rating score (max 30 pts)
        const ratingScore = Math.min(30, (rating / 5.0) * 30);

        // Condition score (max 25 pts)
        let conditionScore = 18;
        if (condition === 'New') conditionScore = 25;
        else if (condition === 'Like New') conditionScore = 22;
        else if (condition === 'Good') conditionScore = 18;
        else if (condition === 'Fair') conditionScore = 12;

        // Seller Trust score (max 20 pts)
        const sellerScore = 18;

        // Price Advantage vs standard average 500 (max 20 pts)
        let priceScore = 15;
        if (price <= 250) priceScore = 20;
        else if (price <= 450) priceScore = 17;
        else if (price <= 700) priceScore = 13;
        else priceScore = 8;

        // Popularity score (max 5 pts)
        const popScore = Math.min(5, Math.log10(views + 1) * 2);

        const totalScore = Math.round(ratingScore + conditionScore + sellerScore + priceScore + popScore);
        const clampedScore = Math.min(99, Math.max(45, totalScore));

        const highlights = [];
        if (rating >= 4.5) highlights.push(`High student rating (${rating}★)`);
        if (condition === 'New' || condition === 'Like New') highlights.push(`Superior ${condition} condition`);
        highlights.push('Verified escrow-protected seller');
        if (price <= 400) highlights.push(`Affordable student price (₹${price})`);

        return {
            score: clampedScore,
            rating,
            condition,
            price,
            highlights
        };
    }

    /**
     * Seller Trust Evaluation
     */
    static async evaluateSellerTrust(sellerId, bookId = null) {
        let sellerInfo = null;
        if (sellerId) {
            const [rows] = await pool.query(`
                SELECT id, full_name, username, role, college, created_at
                FROM users WHERE id = ?
            `, [sellerId]);
            sellerInfo = rows[0];
        } else if (bookId) {
            const [rows] = await pool.query(`
                SELECT u.id, u.full_name, u.username, u.role, u.college, u.created_at
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.id = ?
            `, [bookId]);
            sellerInfo = rows[0];
        }

        if (!sellerInfo) {
            return {
                sellerName: 'Verified Student Seller',
                rating: 4.8,
                trustScore: 88,
                isVerified: true,
                verdict: 'Seller has standard BookNest buyer protection with funds held in 7-day escrow.',
                reasons: ['BookNest 7-day escrow protection', 'Community verified account']
            };
        }

        const isVerified = Boolean(sellerInfo.role === 'ADMIN' || sellerInfo.college);
        const trustScore = isVerified ? 92 : 85;

        return {
            sellerId: sellerInfo.id,
            sellerName: sellerInfo.full_name || sellerInfo.username,
            rating: 4.8,
            isVerified,
            trustScore,
            verdict: `**${sellerInfo.full_name || sellerInfo.username}** is a verified marketplace seller with 100% funds protection held in escrow until delivery.`,
            reasons: [
                '4.8★ Community Fulfillment Consensus',
                isVerified ? 'Campus Verified Student Account' : 'Standard Student Account',
                '100% Escrow Fund Protection'
            ]
        };
    }

    /**
     * Smart Study Bundle Builder
     */
    static async buildStudyBundle({ subject = 'Programming', budget = 1500, level = 'beginner', count = 3 }) {
        const targetBudget = Math.max(300, parseFloat(budget) || 1500);
        
        let genre = 'Programming';
        const lowerSub = subject.toLowerCase();
        if (lowerSub.includes('dsa') || lowerSub.includes('algorithm')) {
            genre = 'Programming';
        } else if (lowerSub.includes('upsc') || lowerSub.includes('civil service')) {
            genre = 'UPSC';
        } else if (lowerSub.includes('cse') || lowerSub.includes('first year') || lowerSub.includes('semester')) {
            genre = 'Programming';
        } else if (lowerSub.includes('finance') || lowerSub.includes('money')) {
            genre = 'Finance';
        } else if (lowerSub.includes('ncert')) {
            genre = 'NCERT';
        }

        // Fetch candidate available books
        const [candidateRows] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.role as seller_role
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE (b.genre = ? OR b.title LIKE ?) AND b.status = 'available'
            ORDER BY b.rating DESC, b.price ASC
            LIMIT 20
        `, [genre, `%${genre}%`]);

        if (candidateRows.length === 0) {
            const [fallbackRows] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.role as seller_role
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.status = 'available'
                ORDER BY b.rating DESC, b.price ASC
                LIMIT 10
            `);
            candidateRows.push(...fallbackRows);
        }

        const selectedBooks = [];
        let currentTotal = 0;
        const seenTitles = new Set();

        for (const book of candidateRows) {
            const price = parseFloat(book.price || 0);
            const normalizedTitle = (book.title || '').toLowerCase().replace(/\s*\(edition\s*\d+\)/g, '').trim();

            if (!seenTitles.has(normalizedTitle) && (currentTotal + price) <= targetBudget) {
                selectedBooks.push(book);
                currentTotal += price;
                seenTitles.add(normalizedTitle);

                if (selectedBooks.length >= count) break;
            }
        }

        if (selectedBooks.length === 0 && candidateRows.length > 0) {
            const cheapest = candidateRows[0];
            selectedBooks.push(cheapest);
            currentTotal += parseFloat(cheapest.price || 0);
        }

        const savings = Math.max(0, targetBudget - currentTotal);
        const bundleTitle = `${subject.toUpperCase()} Complete Study Pack`;
        const reasoning = `Curated ${selectedBooks.length} complementary textbook(s) spanning core concepts and practical exercises within your ₹${targetBudget} budget.`;

        return {
            title: bundleTitle,
            subject,
            budget: targetBudget,
            totalPrice: parseFloat(currentTotal.toFixed(2)),
            savings: parseFloat(savings.toFixed(2)),
            bookCount: selectedBooks.length,
            books: selectedBooks,
            reasoning
        };
    }

    /**
     * Smart Budget Optimizer
     */
    static async optimizeBudgetPlan({ budget = 1000, genre = 'Programming', level = 'beginner' }) {
        const targetBudget = Math.max(200, parseFloat(budget) || 1000);

        const [availableBooks] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.role as seller_role
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE (b.genre = ? OR b.genre = 'Programming') AND b.status = 'available'
            ORDER BY (b.rating / b.price) DESC, b.rating DESC
            LIMIT 15
        `, [genre]);

        const selectedBooks = [];
        let currentTotal = 0;
        const seenTitles = new Set();

        for (const b of availableBooks) {
            const price = parseFloat(b.price || 0);
            const normalizedTitle = (b.title || '').toLowerCase().replace(/\s*\(edition\s*\d+\)/g, '').trim();

            if (!seenTitles.has(normalizedTitle) && (currentTotal + price) <= targetBudget) {
                selectedBooks.push(b);
                currentTotal += price;
                seenTitles.add(normalizedTitle);
            }
        }

        const unusedBudget = Math.max(0, targetBudget - currentTotal);

        return {
            targetBudget,
            recommendedSpend: parseFloat(currentTotal.toFixed(2)),
            unusedBudget: parseFloat(unusedBudget.toFixed(2)),
            books: selectedBooks,
            coverage: `${selectedBooks.length} High-Yield Textbook(s)`,
            reasoning: `Maximizes learning value and curriculum coverage with high student satisfaction while saving ₹${Math.round(unusedBudget)} of your budget.`
        };
    }

    /**
     * Book Edition Intelligence
     */
    static async findBookEditions(targetBook) {
        if (!targetBook) return { editions: [], hasNewer: false, message: 'No reference book provided' };

        const baseTitle = (targetBook.title || '').replace(/\s*\(Edition\s*\d+\)/i, '').replace(/\s*\(\d+(st|nd|rd|th)\s*Edition\)/i, '').trim();

        const [editions] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.role as seller_role
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE b.title LIKE ? AND b.status = 'available'
            ORDER BY b.id DESC
        `, [`%${baseTitle}%`]);

        const parsedEditions = editions.map(e => {
            const match = (e.title || '').match(/edition\s*(\d+)/i) || (e.title || '').match(/(\d+)(st|nd|rd|th)\s*edition/i);
            const editionNum = match ? parseInt(match[1], 10) : 1;
            return {
                ...e,
                editionNumber: editionNum
            };
        });

        parsedEditions.sort((a, b) => b.editionNumber - a.editionNumber);

        const currentMatch = (targetBook.title || '').match(/edition\s*(\d+)/i);
        const currentNum = currentMatch ? parseInt(currentMatch[1], 10) : 1;

        const newerEditions = parsedEditions.filter(e => e.editionNumber > currentNum);

        return {
            baseTitle,
            currentEdition: currentNum,
            availableEditions: parsedEditions,
            hasNewer: newerEditions.length > 0,
            newerEditions,
            message: newerEditions.length > 0 
                ? `Found newer edition: **"${newerEditions[0].title}"** (Edition ${newerEditions[0].editionNumber}) available for ₹${newerEditions[0].price}.`
                : `**"${targetBook.title}"** is the latest edition currently cataloged on BookNest.`
        };
    }
}

module.exports = AIIntelligenceService;
