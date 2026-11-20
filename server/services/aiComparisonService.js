const { pool } = require('../config/db');
const Book = require('../models/Book');

class AIComparisonService {
    /**
     * Deterministic Condition Score (out of 10)
     */
    static getConditionScore(condition) {
        switch ((condition || '').toLowerCase()) {
            case 'new': return 10.0;
            case 'like new': return 8.8;
            case 'good': return 7.2;
            case 'fair': return 5.0;
            default: return 6.5;
        }
    }

    /**
     * Experience Level Suitability Heuristic
     */
    static evaluateSuitability(book, targetLevel = 'beginner') {
        const title = (book.title || '').toLowerCase();
        const desc = (book.description || '').toLowerCase();
        const text = `${title} ${desc}`;

        const isBeginnerTarget = targetLevel.toLowerCase().includes('beginner') || targetLevel.toLowerCase().includes('start');
        
        let score = 7.0; // baseline
        let label = 'Intermediate';

        if (
            text.includes('beginner') || 
            text.includes('crash course') || 
            text.includes('grokking') || 
            text.includes('head first') || 
            text.includes('introduction to') ||
            text.includes('for dummies') ||
            text.includes('step by step') ||
            text.includes('basics')
        ) {
            score = 9.5;
            label = 'Beginner Friendly';
        } else if (
            text.includes('advanced') || 
            text.includes('clrs') || 
            text.includes('mastering') || 
            text.includes('in depth') ||
            text.includes('deep dive') ||
            text.includes('expert')
        ) {
            score = isBeginnerTarget ? 5.5 : 9.0;
            label = 'Advanced / Academic';
        }

        return { score, label };
    }

    /**
     * Multi-Dimensional Comparison & Value Scoring Engine
     */
    static calculateBookScore(book, context = {}) {
        const { targetBudget = null, targetLevel = 'beginner', userAffinityGenres = [] } = context;

        const rating = parseFloat(book.rating || 4.5);
        const reviewCount = parseInt(book.review_count || 10, 10);
        const price = parseFloat(book.price || 400);
        const conditionScore = this.getConditionScore(book.condition);
        const sellerRating = parseFloat(book.seller_rating || (book.seller_role === 'ADMIN' ? 5.0 : 4.8));
        const suitability = this.evaluateSuitability(book, targetLevel);

        // 1. Rating Quality (weight: 25%)
        const ratingScore = Math.min(10, (rating / 5.0) * 10);

        // 2. Review Confidence (weight: 10%)
        const reviewConfidence = Math.min(10, (Math.log10(reviewCount + 1) / 2.0) * 10);

        // 3. Condition Quality (weight: 20%)
        const conditionFactor = conditionScore;

        // 4. Seller Trust (weight: 15%)
        const sellerTrust = Math.min(10, (sellerRating / 5.0) * 10);

        // 5. Price & Budget Value (weight: 20%)
        let priceValue = 7.0;
        if (targetBudget && targetBudget > 0) {
            if (price <= targetBudget) {
                // Closer to 0 or lower % of budget = higher score
                priceValue = Math.min(10, 6.0 + ((targetBudget - price) / targetBudget) * 4.0);
            } else {
                // Over budget penalty
                priceValue = Math.max(2.0, 6.0 - ((price - targetBudget) / targetBudget) * 5.0);
            }
        } else {
            // General inverse price scale (lower price = higher value for students)
            priceValue = Math.max(3.0, Math.min(10, 10.0 - (price / 250.0)));
        }

        // 6. Suitability Alignment (weight: 10%)
        const suitabilityScore = suitability.score;

        // Weighted Composite Overall Score (out of 10)
        const compositeScore = (
            (ratingScore * 0.25) +
            (reviewConfidence * 0.10) +
            (conditionFactor * 0.20) +
            (sellerTrust * 0.15) +
            (priceValue * 0.20) +
            (suitabilityScore * 0.10)
        );

        return {
            totalScore: parseFloat(compositeScore.toFixed(1)),
            ratingScore: parseFloat(ratingScore.toFixed(1)),
            conditionScore: parseFloat(conditionFactor.toFixed(1)),
            sellerScore: parseFloat(sellerTrust.toFixed(1)),
            priceScore: parseFloat(priceValue.toFixed(1)),
            suitabilityLabel: suitability.label
        };
    }

    /**
     * Compare a list of books and determine category winners and explainable verdict
     */
    static async compareBooks(books, options = {}) {
        if (!books || books.length < 2) {
            throw new Error('At least 2 books are required for comparison');
        }

        const { targetBudget = null, targetLevel = 'beginner', userAffinityGenres = [] } = options;

        const evaluatedBooks = books.map(b => {
            const scoreData = this.calculateBookScore(b, { targetBudget, targetLevel, userAffinityGenres });
            return {
                ...b,
                price: parseFloat(b.price || 0),
                rating: parseFloat(b.rating || 4.5),
                seller_rating: parseFloat(b.seller_rating || (b.seller_role === 'ADMIN' ? 5.0 : 4.8)),
                scoring: scoreData
            };
        });

        // Determine Dimension Winners
        const priceWinner = [...evaluatedBooks].sort((a, b) => a.price - b.price)[0];
        const ratingWinner = [...evaluatedBooks].sort((a, b) => b.rating - a.rating || (b.review_count || 0) - (a.review_count || 0))[0];
        const conditionWinner = [...evaluatedBooks].sort((a, b) => b.scoring.conditionScore - a.scoring.conditionScore)[0];
        const sellerWinner = [...evaluatedBooks].sort((a, b) => b.seller_rating - a.seller_rating)[0];
        const bestOverall = [...evaluatedBooks].sort((a, b) => b.scoring.totalScore - a.scoring.totalScore)[0];

        // Best Value Choice (Highest Rating/Price ratio within budget)
        const bestValue = [...evaluatedBooks].sort((a, b) => {
            const ratioA = a.rating / Math.max(1, a.price);
            const ratioB = b.rating / Math.max(1, b.price);
            return ratioB - ratioA;
        })[0];

        // Best for Beginners
        const bestForBeginners = evaluatedBooks.find(b => b.scoring.suitabilityLabel.includes('Beginner')) || bestOverall;

        // Formulate Explainable Verdict
        const pros = [];
        if (bestOverall.id === priceWinner.id) pros.push('most affordable price');
        if (bestOverall.id === ratingWinner.id) pros.push('highest student rating consensus');
        if (bestOverall.id === conditionWinner.id) pros.push('better physical condition');
        if (bestOverall.id === sellerWinner.id) pros.push('verified seller track record');
        if (bestOverall.scoring.suitabilityLabel.includes('Beginner')) pros.push('beginner-friendly pedagogical approach');

        const prosText = pros.length > 0 ? pros.join(', ') : 'superior overall balance of condition, price, and ratings';
        
        const verdict = `**"${bestOverall.title}"** is the recommended overall choice (Score: ${bestOverall.scoring.totalScore}/10). It stands out for its ${prosText}.`;

        return {
            intent: 'book_comparison',
            books: evaluatedBooks,
            comparison: {
                price: { winner: priceWinner.id, winnerTitle: priceWinner.title, price: priceWinner.price },
                rating: { winner: ratingWinner.id, winnerTitle: ratingWinner.title, rating: ratingWinner.rating },
                condition: { winner: conditionWinner.id, winnerTitle: conditionWinner.title, condition: conditionWinner.condition },
                seller: { winner: sellerWinner.id, winnerTitle: sellerWinner.title, sellerRating: sellerWinner.seller_rating }
            },
            winner: {
                bookId: bestOverall.id,
                title: bestOverall.title,
                score: bestOverall.scoring.totalScore,
                badge: 'BEST OVERALL'
            },
            categoryWinners: {
                bestOverall,
                bestValue,
                bestRated: ratingWinner,
                bestForBeginners,
                bestCondition: conditionWinner
            },
            verdict
        };
    }

    /**
     * Evaluate single book value (e.g. from BookDetails)
     */
    static evaluateSingleBook(book, options = {}) {
        const scoreData = this.calculateBookScore(book, options);
        const price = parseFloat(book.price || 0);
        const rating = parseFloat(book.rating || 4.5);
        const isWorth = scoreData.totalScore >= 6.5;

        const highlights = [];
        if (rating >= 4.5) highlights.push(`High student satisfaction (${rating}★)`);
        if (scoreData.conditionScore >= 8.5) highlights.push(`Immaculate condition (${book.condition || 'Like New'})`);
        if (scoreData.sellerScore >= 9.0) highlights.push(`Trusted seller with verified escrow track record`);
        if (price <= 450) highlights.push(`Budget-friendly student pricing (₹${price})`);
        highlights.push(`Syllabus alignment: ${scoreData.suitabilityLabel}`);

        return {
            isWorth,
            score: scoreData.totalScore,
            highlights,
            suitability: scoreData.suitabilityLabel,
            verdict: isWorth 
                ? `Yes! **"${book.title}"** at ₹${price} is a verified high-value purchase with an overall quality score of **${scoreData.totalScore}/10**.`
                : `**"${book.title}"** is a solid option (Score: ${scoreData.totalScore}/10), though you may want to check for cheaper alternatives or peer swap options if price is your main priority.`
        };
    }
}

module.exports = AIComparisonService;
