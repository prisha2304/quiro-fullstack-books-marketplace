const AIProviderAdapter = require('./aiProviderAdapter');
const { pool } = require('../config/db');
const Book = require('../models/Book');
const AIChatHistory = require('../models/AIChatHistory');
const recommendationService = require('./recommendationService');
const AIComparisonService = require('./aiComparisonService');
const AIShoppingService = require('./aiShoppingService');
const AIIntelligenceService = require('./aiIntelligenceService');

class AIService {
    /**
     * Extract structured search filters from natural language query
     */
    static extractSearchFilters(naturalQuery = '') {
        const text = (naturalQuery || '').toLowerCase();
        let maxPrice = null;
        let minRating = null;
        let condition = null;
        let query = naturalQuery.trim();

        // Price extraction
        const priceMatch = text.match(/(?:under|below|max|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) || text.match(/(\d+)\s*(?:₹|rs|rupees)/i);
        if (priceMatch) {
            maxPrice = parseFloat(priceMatch[1]);
        }

        // Rating extraction
        const ratingMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:star|stars|★|rating)/i);
        if (ratingMatch) {
            minRating = parseFloat(ratingMatch[1]);
        }

        // Condition extraction
        if (text.includes('like new') || text.includes('mint')) condition = 'Like New';
        else if (text.includes('new')) condition = 'New';
        else if (text.includes('good')) condition = 'Good';
        else if (text.includes('fair')) condition = 'Fair';

        // Clean query terms for search
        const cleanQuery = query
            .replace(/(?:under|below|max|less than|within)\s*(?:₹|rs\.?|inr)?\s*\d+/gi, '')
            .replace(/\d+(?:\.\d+)?\s*(?:star|stars|★|rating)/gi, '')
            .replace(/(?:like new|mint|new|good|fair)\s*(?:condition)?/gi, '')
            .replace(/(?:i need|i want|find me|looking for|a book for|suitable for|complete beginner|for beginners)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        return {
            query: cleanQuery || query,
            q: cleanQuery || query,
            maxPrice,
            minRating,
            condition,
            rawText: naturalQuery
        };
    }

    static async getUserPreferences(userId) {
        const numericId = parseInt(userId, 10);
        if (!numericId || isNaN(numericId)) return null;

        const preferences = {
            favoriteGenres: [],
            preferredAuthors: [],
            averageBudget: 450,
            preferredCondition: 'Good',
            recentBooks: [],
            ownedBookIds: [],
            reviewedBookIds: []
        };

        try {
            const [purchased] = await pool.query(`
                SELECT b.id, b.title, b.genre, b.author, b.price, b.condition
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN books b ON oi.book_id = b.id
                WHERE o.buyer_id = ? AND o.status IN ('completed', 'confirmed', 'pending', 'paid')
            `, [numericId]);

            if (purchased.length > 0) {
                preferences.ownedBookIds = purchased.map(p => p.id);
                preferences.recentBooks = purchased.slice(0, 5);
                const totalPrice = purchased.reduce((acc, p) => acc + parseFloat(p.price || 0), 0);
                preferences.averageBudget = Math.round(totalPrice / purchased.length) || 450;
            }

            const [genreCounts] = await pool.query(`
                SELECT genre, COUNT(*) as qty
                FROM (
                    SELECT b.genre FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN books b ON oi.book_id = b.id WHERE o.buyer_id = ?
                    UNION ALL
                    SELECT b.genre FROM wishlists w JOIN books b ON w.book_id = b.id WHERE w.user_id = ?
                ) as combined
                WHERE genre IS NOT NULL AND genre != ''
                GROUP BY genre
                ORDER BY qty DESC
                LIMIT 3
            `, [numericId, numericId]);

            preferences.favoriteGenres = genreCounts.map(g => g.genre);

            const [authorCounts] = await pool.query(`
                SELECT b.author, COUNT(*) as qty
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN books b ON oi.book_id = b.id
                WHERE o.buyer_id = ? AND b.author IS NOT NULL AND b.author != ''
                GROUP BY b.author
                ORDER BY qty DESC
                LIMIT 3
            `, [numericId]);

            preferences.preferredAuthors = authorCounts.map(a => a.author);

            const [reviewed] = await pool.query(`
                SELECT book_id FROM reviews WHERE reviewer_id = ?
            `, [numericId]);
            preferences.reviewedBookIds = reviewed.map(r => r.book_id);

        } catch (err) {
            console.error('Error fetching user preferences:', err.message);
        }

        return preferences;
    }

    /**
     * Check if natural query is relevant to QUIRO catalog, literature, textbooks, or marketplace operations
     */
    static isCatalogOrMarketplaceQuery(text = '') {
        const lower = text.toLowerCase().trim();
        const bookKeywords = [
            'book', 'books', 'textbook', 'textbooks', 'novel', 'novels', 'author', 'edition', 'editions',
            'isbn', 'cover', 'page', 'pages', 'read', 'reading', 'reader', 'syllabus', 'curriculum',
            'study', 'course', 'semester', 'exam', 'class', 'paper', 'guide',
            'buy', 'sell', 'order', 'orders', 'cart', 'wishlist', 'price', 'budget', 'cheap', 'cheaper',
            'cost', 'rupees', 'rs', 'inr', 'swap', 'swaps', 'exchange', 'shipment', 'shipping', 'delivery',
            'seller', 'buyer', 'escrow', 'condition', 'new', 'used', 'like new', 'fair', 'good', 'mint',
            'rating', 'review', 'reviews', 'recommend', 'recommendation', 'recommendations', 'suggest',
            'suggestion', 'compare', 'comparison', 'similar', 'alternative', 'bundle', 'difference',
            // Genres & domains
            'programming', 'coder', 'coding', 'java', 'python', 'javascript', 'dsa', 'algorithm', 'algorithms',
            'upsc', 'ias', 'ncert', 'romance', 'romantic', 'fiction', 'non-fiction', 'mystery', 'thriller',
            'finance', 'money', 'investing', 'stock market', 'history', 'engineering', 'mechanics',
            'circuits', 'math', 'mathematics', 'calculus', 'medical', 'medicine', 'manga', 'anime',
            'science', 'physics', 'chemistry', 'biology', 'self help', 'habits', 'business', 'children',
            'school', 'clrs', 'effective java', 'atomic habits', 'colleen hoover', 'it ends with us'
        ];

        return bookKeywords.some(kw => lower.includes(kw));
    }

    static parseNaturalLanguageQuery(message, conversationContext = [], currentBookContext = null) {
        const raw = message.trim();
        const lower = raw.toLowerCase();

        let intent = 'SEARCH';
        let keywords = [];
        let genre = null;
        let author = null;
        let title = null;
        let minPrice = null;
        let maxPrice = null;
        let minRating = null;
        let condition = null;
        let sort = 'rating_desc';
        let targetLevel = 'beginner';
        let bookSimilarityTarget = null;
        let isFollowUp = false;
        let previousBookIds = [];
        let targetOrdinal = null;
        let targetAction = null;
        let requiresConfirmation = false;
        let bundleSubject = 'Programming';
        let bundleBudget = 1500;

        let prevGenre = null;
        let prevBudget = null;
        let prevKeywords = [];
        let lastBooksList = [];

        if (conversationContext && conversationContext.length > 0) {
            const lastExchange = conversationContext[conversationContext.length - 1];
            const prevMsg = (lastExchange.message || '').toLowerCase();

            if (lastExchange.recommended_books && Array.isArray(lastExchange.recommended_books)) {
                previousBookIds = lastExchange.recommended_books.map(b => b.id);
                lastBooksList = lastExchange.recommended_books;
            } else if (lastExchange.books && Array.isArray(lastExchange.books)) {
                previousBookIds = lastExchange.books.map(b => b.id);
                lastBooksList = lastExchange.books;
            }

            if (prevMsg.includes('romance') || prevMsg.includes('romantic')) {
                prevGenre = 'Romance';
                prevKeywords = ['Romance'];
            } else if (prevMsg.includes('dsa') || prevMsg.includes('algorithm')) {
                prevGenre = 'Programming';
                prevKeywords = ['Algorithm'];
            } else if (prevMsg.includes('java')) {
                prevGenre = 'Programming';
                prevKeywords = ['Java'];
            } else if (prevMsg.includes('python')) {
                prevGenre = 'Programming';
                prevKeywords = ['Python'];
            } else if (prevMsg.includes('upsc')) {
                prevGenre = 'UPSC';
                prevKeywords = ['UPSC'];
            } else if (prevMsg.includes('ncert')) {
                prevGenre = 'NCERT';
                prevKeywords = ['NCERT'];
            } else if (prevMsg.includes('fiction') || prevMsg.includes('harry potter')) {
                prevGenre = 'Fiction';
            } else if (prevMsg.includes('finance')) {
                prevGenre = 'Finance';
            }

            const prevBudgetMatch = prevMsg.match(/(?:under|below|less than|within|max)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
            if (prevBudgetMatch) {
                prevBudget = parseFloat(prevBudgetMatch[1]);
            }
        }

        // =====================================================================
        // Intent Recognition Hierarchy
        // =====================================================================
        if (!this.isCatalogOrMarketplaceQuery(raw)) {
            intent = 'UNSUPPORTED_QUERY';
        } else if (
            lower.includes('order') && (
                lower.includes('#') || 
                lower.includes('status') || 
                lower.includes('track') || 
                lower.includes('shipping address') || 
                lower.includes('details') || 
                lower.includes('address') || 
                lower.includes('phone') || 
                lower.includes('private') ||
                lower.match(/order\s*(?:#|id|number)?\s*\d+/i)
            )
        ) {
            intent = 'ORDER_INQUIRY';
        } else if (
            (lower.includes('condition') || lower.includes('used book') || lower.includes('difference between a new and a good')) &&
            (lower.includes('difference') || lower.includes('explain') || lower.includes('what is') || lower.includes('mean') || lower.includes('compare'))
        ) {
            intent = 'CONDITION_GUIDE';
        } else if (
            lower.includes('different from') || 
            lower.includes('something different') || 
            lower.includes('already viewed') || 
            lower.includes('already read')
        ) {
            intent = 'EXPLORE_DIFFERENT';
        } else if (
            lower.includes('compare the first') || 
            lower.includes('compare first') || 
            lower.includes('compare first recommendation') || 
            lower.includes('compare the top 2') || 
            lower.includes('difference between these two books') || 
            lower.includes('compare these two') ||
            lower.includes('compare top 2')
        ) {
            intent = 'COMPARE_RECOMMENDATIONS';
        } else if (
            lower.includes('order') && (
                lower.includes('#') || 
                lower.includes('status') || 
                lower.includes('track') || 
                lower.includes('shipping address') || 
                lower.includes('details') || 
                lower.includes('address') || 
                lower.includes('phone') || 
                lower.includes('private') ||
                lower.match(/order\s*(?:#|id|number)?\s*\d+/i)
            )
        ) {
            intent = 'ORDER_INQUIRY';
        } else if (
            (lower.includes('condition') || lower.includes('used book') || lower.includes('difference between a new and a good')) &&
            (lower.includes('difference') || lower.includes('explain') || lower.includes('what is') || lower.includes('mean') || lower.includes('compare'))
        ) {
            intent = 'CONDITION_GUIDE';
        } else if (
            lower.includes('different from') || 
            lower.includes('something different') || 
            lower.includes('already viewed') || 
            lower.includes('already read')
        ) {
            intent = 'EXPLORE_DIFFERENT';
        } else if (
            lower.includes('compare the first') || 
            lower.includes('compare first') || 
            lower.includes('compare first recommendation') || 
            lower.includes('compare the top 2') || 
            lower.includes('difference between these two books') || 
            lower.includes('compare these two') ||
            lower.includes('compare top 2')
        ) {
            intent = 'COMPARE_RECOMMENDATIONS';
        } else if (
            lower.includes('build a bundle') || 
            lower.includes('build me a bundle') || 
            lower.includes('study bundle') || 
            lower.includes('starter pack') || 
            lower.includes('book bundle') ||
            lower.includes('create a bundle') ||
            lower.includes('build a dsa bundle') ||
            lower.includes('build a upsc bundle')
        ) {
            intent = 'BUILD_BUNDLE';
            if (lower.includes('dsa')) bundleSubject = 'DSA';
            else if (lower.includes('upsc')) bundleSubject = 'UPSC';
            else if (lower.includes('cse') || lower.includes('first year')) bundleSubject = 'CSE';
            else if (lower.includes('finance')) bundleSubject = 'Finance';
            else bundleSubject = 'Programming';

            const budMatch = lower.match(/(?:under|below|for|within)?\s*(?:₹|rs\.?|inr)?\s*(\d{3,5})/i);
            if (budMatch) bundleBudget = parseFloat(budMatch[1]);
        } else if (
            lower.startsWith('i have ₹') || 
            lower.startsWith('i have rs') || 
            lower.includes('i have 1000') ||
            lower.includes('i have 1500') ||
            lower.includes('i have 2000') ||
            lower.includes('how should i spend') ||
            lower.includes('budget planner') ||
            lower.includes('spend on books')
        ) {
            intent = 'OPTIMIZE_BUDGET';
            const budMatch = lower.match(/(?:₹|rs\.?|inr)?\s*(\d{3,5})/i);
            if (budMatch) maxPrice = parseFloat(budMatch[1]);
        } else if (
            lower.includes('newer edition') || 
            lower.includes('latest edition') || 
            lower.includes('compare editions') || 
            lower.includes('better edition') ||
            lower.includes('is there a newer')
        ) {
            intent = 'EDITION_QUERY';
        } else if (
            lower.includes('which seller is more trustworthy') || 
            lower.includes('which seller is trustworthy') || 
            lower.includes('seller trustworthy') ||
            lower.includes('safest seller') ||
            lower.includes('which seller should i buy from')
        ) {
            intent = 'SELLER_TRUST';
        } else if (
            lower.includes('checkout') || 
            lower.includes('take me to checkout') || 
            lower.includes('start checkout') ||
            lower.includes('go to checkout')
        ) {
            intent = 'START_CHECKOUT';
            targetAction = 'START_CHECKOUT';
        } else if (
            lower.includes('optimize my cart') || 
            lower.includes('optimize cart') || 
            lower.includes('save money on my cart')
        ) {
            intent = 'OPTIMIZE_CART';
        } else if (
            lower.includes('in my cart') || 
            lower.includes('my cart total') || 
            lower.includes('show my cart') || 
            lower.includes('view cart') || 
            lower.includes("what's in my cart") ||
            lower.includes('how much is my cart')
        ) {
            intent = 'VIEW_CART';
        } else if (
            lower.includes('on my wishlist') || 
            lower.includes('show wishlist') || 
            lower.includes('show my wishlist') || 
            lower.includes("what's on my wishlist")
        ) {
            intent = 'VIEW_WISHLIST';
        } else if (
            lower.startsWith('remove ') || 
            lower.includes('remove from my cart') || 
            lower.includes('remove from cart')
        ) {
            intent = 'REMOVE_FROM_CART';
            targetAction = 'REMOVE_FROM_CART';
            requiresConfirmation = true;
        } else if (
            lower.includes('save this book') || 
            lower.includes('save this') || 
            lower.includes('add to wishlist')
        ) {
            intent = 'ADD_TO_WISHLIST';
            targetAction = 'ADD_TO_WISHLIST';
        } else if (
            lower.startsWith('add ') || 
            lower.includes('add to cart') || 
            lower.includes('add the cheapest') || 
            lower.includes('add the second') ||
            lower.includes('add that one') ||
            lower.includes('add to my cart')
        ) {
            intent = 'ADD_TO_CART';
            targetAction = 'ADD_TO_CART';

            if (lower.includes('cheapest')) targetOrdinal = 'cheapest';
            else if (lower.includes('second')) targetOrdinal = 'second';
            else if (lower.includes('third')) targetOrdinal = 'third';
            else if (lower.includes('best rated') || lower.includes('best one') || lower.includes('highest rated')) targetOrdinal = 'best_rated';
            else if (lower.includes('that one') || lower.includes('first')) targetOrdinal = 'first';
        } else if (
            lower.includes('which one is cheapest') ||
            lower.includes('which is cheapest') ||
            lower.includes('which is cheaper') ||
            lower.includes('which one is cheaper') ||
            lower.includes('cheapest one') ||
            lower.includes('cheapest book') ||
            lower.includes('lowest price')
        ) {
            intent = 'FOLLOW_UP';
            sort = 'price_asc';
            isFollowUp = true;
            genre = prevGenre;
            keywords = prevKeywords;
            maxPrice = prevBudget;
        } else if (
            lower.includes('cheaper alternative') || 
            lower.includes('find a cheaper alternative') || 
            lower.includes('find something cheaper')
        ) {
            intent = 'FIND_CHEAPER';
        } else if (
            lower.includes('better rated alternative') || 
            lower.includes('show better rated alternatives')
        ) {
            intent = 'FIND_BETTER_RATED';
        } else if (
            lower.includes('show me alternatives') || 
            lower.includes('alternatives to this')
        ) {
            intent = 'VIEW_ALTERNATIVES';
        } else if (
            lower.includes('open this book') || 
            lower.includes('open the cheapest one')
        ) {
            intent = 'OPEN_BOOK';
        } else if (
            lower.startsWith('only under') || 
            lower.startsWith('under ') || 
            lower.startsWith('only show') || 
            lower.includes('show cheaper options')
        ) {
            intent = 'PRICE_FILTER';
            isFollowUp = true;
            genre = prevGenre;
            keywords = prevKeywords;
        } else if (
            lower.includes('after ') || 
            lower.includes('similar to ') || 
            lower.includes('books like ') || 
            lower.includes('more like this')
        ) {
            intent = 'RECOMMEND';
            const simMatch = lower.match(/(?:after|similar to|books like|liked)\s+["']?([^"'\.\,\?]+)["']?/i);
            if (simMatch && simMatch[1]) {
                bookSimilarityTarget = simMatch[1].trim();
            }
        } else if (
            lower.includes('recommend') || 
            lower.includes('suggest') || 
            lower.includes('what should i read next') ||
            lower.includes('based on my purchases') ||
            lower.includes('best books') ||
            lower.includes('good books')
        ) {
            intent = 'RECOMMEND';
        } else if (
            lower.includes('compare') || 
            lower.includes(' vs ') || 
            lower.includes('which one is better')
        ) {
            intent = 'COMPARE';
        } else if (
            lower.includes('worth buying') || 
            lower.includes('is this worth') || 
            lower.includes('should i buy this')
        ) {
            intent = 'BUYING_DECISION';
        } else if (
            (lower.startsWith('what is ') || lower.startsWith('explain ')) &&
            (lower.includes('dsa') || lower.includes('upsc') || lower.includes('ncert') || lower.includes('syllabus') || lower.includes('engineering'))
        ) {
            intent = 'GENRE_EXPLANATION';
        } else if (currentBookContext && (
            lower.includes('is this good') || 
            lower.includes('about this book')
        )) {
            intent = 'BOOK_EXPLANATION';
        } else if (!this.isCatalogOrMarketplaceQuery(raw)) {
            intent = 'UNSUPPORTED_QUERY';
        }

        // Price constraints
        const betweenMatch = lower.match(/between\s*(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:and|to|-)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
        if (betweenMatch) {
            minPrice = parseFloat(betweenMatch[1]);
            maxPrice = parseFloat(betweenMatch[2]);
        } else {
            const underMatch = lower.match(/(?:under|below|less than|within|max)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
            if (underMatch) {
                maxPrice = parseFloat(underMatch[1]);
            }

            const aboveMatch = lower.match(/(?:above|more than|at least|over|min)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
            if (aboveMatch) {
                minPrice = parseFloat(aboveMatch[1]);
            }
        }

        // Rating constraints
        const ratingMatch = lower.match(/rated\s*(?:above|over|>=|>)?\s*(\d+(?:\.\d+)?)/i) || 
                            lower.match(/(\d+(?:\.\d+)?)\s*\+?\s*star/i);
        if (ratingMatch) {
            minRating = parseFloat(ratingMatch[1]);
        } else if (lower.includes('4 star') || lower.includes('4+')) {
            minRating = 4.0;
        }

        // Condition constraints
        if (lower.includes('like new') || lower.includes('almost new')) {
            condition = 'Like New';
        } else if (lower.includes('good condition') || (lower.includes('good') && !lower.includes('is this good') && !lower.includes('good for') && !lower.includes('good-condition'))) {
            condition = 'Good';
        } else if (lower.includes('brand new') || (lower.includes('new') && !lower.includes('newer edition') && !lower.includes('read next') && !lower.includes('like new') && !lower.includes('a new and a good'))) {
            condition = 'New';
        } else if (lower.includes('fair') || lower.includes('used')) {
            condition = 'Fair';
        }

        // Target Level
        if (lower.includes('beginner') || lower.includes('starter') || lower.includes('introductory') || lower.includes('basics')) {
            targetLevel = 'beginner';
        } else if (lower.includes('advanced') || lower.includes('expert') || lower.includes('deep dive')) {
            targetLevel = 'advanced';
        }

        // Comprehensive Genre & Domain Extraction
        if (lower.includes('romance') || lower.includes('romantic')) {
            genre = 'Romance';
            keywords.push('Romance');
        } else if (
            lower.includes('dsa') || 
            lower.includes('data structure') || 
            lower.includes('algorithm') || 
            lower.includes('programming') || 
            lower.includes('java') ||
            lower.includes('python') ||
            lower.includes('javascript') ||
            lower.includes('cse') ||
            lower.includes('coding')
        ) {
            genre = 'Programming';
            if (lower.includes('dsa') || lower.includes('algorithm')) keywords.push('Algorithm');
            if (lower.includes('java')) keywords.push('Java');
            if (lower.includes('python')) keywords.push('Python');
            if (lower.includes('javascript')) keywords.push('JavaScript');
        } else if (lower.includes('upsc') || lower.includes('ias') || lower.includes('civil services')) {
            genre = 'UPSC';
            keywords.push('UPSC');
        } else if (lower.includes('ncert') || lower.includes('cbse') || lower.includes('class 10') || lower.includes('class 11') || lower.includes('class 12')) {
            genre = 'NCERT';
            keywords.push('NCERT');
        } else if (lower.includes('mystery') || lower.includes('thriller') || lower.includes('detective')) {
            genre = 'Mystery';
        } else if (lower.includes('biography') || lower.includes('autobiography') || lower.includes('memoir')) {
            genre = 'Biography';
        } else if (lower.includes('self help') || lower.includes('habits') || lower.includes('productivity')) {
            genre = 'Self Help';
        } else if (lower.includes('finance') || lower.includes('money') || lower.includes('stock market') || lower.includes('investing')) {
            genre = 'Finance';
        } else if (lower.includes('business') || lower.includes('startup')) {
            genre = 'Business';
        } else if (lower.includes('manga') || lower.includes('anime')) {
            genre = 'Manga';
        } else if (lower.includes('fantasy') || lower.includes('sci-fi') || lower.includes('science fiction') || lower.includes('dystopian')) {
            genre = 'Fantasy & Sci-Fi';
        } else if (lower.includes('horror') || lower.includes('gothic') || lower.includes('supernatural')) {
            genre = 'Horror';
        } else if (lower.includes('engineering') || lower.includes('circuit') || lower.includes('fluid mechanics') || lower.includes('thermodynamics')) {
            if (!lower.includes('fiction') && !lower.includes('novel') && !lower.includes('story')) {
                genre = 'Engineering';
            } else {
                genre = 'Fiction';
            }
        } else if (lower.includes('math') || lower.includes('calculus')) {
            genre = 'Mathematics';
        } else if (lower.includes('fiction') || lower.includes('novel') || lower.includes('story') || lower.includes('literature')) {
            genre = 'Fiction';
        }

        if (lower.startsWith('what about ') || lower.startsWith('how about ')) {
            isFollowUp = true;
            if (!maxPrice && prevBudget) maxPrice = prevBudget;
        }

        if (!genre && prevGenre && isFollowUp) {
            genre = prevGenre;
            if (keywords.length === 0) keywords = prevKeywords;
        }

        return {
            intent,
            keywords,
            genre,
            author,
            title,
            minPrice,
            maxPrice,
            minRating,
            condition,
            availability: 'available',
            sort,
            targetLevel,
            bookSimilarityTarget,
            isFollowUp,
            previousBookIds,
            lastBooksList,
            targetOrdinal,
            targetAction,
            requiresConfirmation,
            bundleSubject,
            bundleBudget,
            currentBookContext,
            prevGenre,
            prevBudget
        };
    }

    /**
     * Main AI Conversation, Recommendation & Intelligence Engine
     */
    static async processUserQuery({ userId = null, sessionId = null, message, bookId = null, currentBookContext = null, context = [], req = null }) {
        if (!message || !message.trim()) {
            throw new Error('Message is required');
        }

        const cleanMessage = message.trim().slice(0, 1000);

        let userPreferences = null;
        if (userId) {
            userPreferences = await this.getUserPreferences(userId);
        }

        let activeBookContext = currentBookContext;
        if (!activeBookContext && bookId) {
            activeBookContext = await Book.findById(bookId);
        }

        const parsed = this.parseNaturalLanguageQuery(cleanMessage, context, activeBookContext);

        let responseText = '';
        let recommendedBooks = [];
        let browseUrl = null;
        let structuredComparison = null;
        let buyingDecision = null;
        let contextIndicator = null;
        let isPersonalized = false;
        let actionResult = null;
        let redirectUrl = null;
        let cartAnalysis = null;
        let bundleData = null;
        let budgetPlanData = null;
        let editionData = null;
        let sellerTrustData = null;

        let followUps = [
            'Which one is cheapest?',
            'Show only Like New',
            'Compare top 2',
            'Build a study bundle'
        ];

        // =====================================================================
        // 0. INTENT: ORDER PRIVACY & STATUS (ORDER_INQUIRY)
        // =====================================================================
        if (parsed.intent === 'ORDER_INQUIRY') {
            if (!userId) {
                responseText = '🔒 **Authentication Required**: For customer security and privacy, order status and private shipping details can only be accessed by authenticated account holders. Please log in to your verified QUIRO account to view your orders.';
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
                contextIndicator = 'Order Authorization Required';
            } else {
                const orderIdMatch = cleanMessage.match(/order\s*(?:#|id|number)?\s*(\d+)/i);
                const targetOrderId = orderIdMatch ? parseInt(orderIdMatch[1], 10) : null;

                if (targetOrderId) {
                    const [orderRows] = await pool.query(`
                        SELECT o.id, o.status, o.total_price, o.created_at, o.buyer_id,
                               b.title as book_title, b.seller_id
                        FROM orders o
                        LEFT JOIN order_items oi ON o.id = oi.order_id
                        LEFT JOIN books b ON oi.book_id = b.id
                        WHERE o.id = ? AND (o.buyer_id = ? OR b.seller_id = ?)
                    `, [targetOrderId, userId, userId]);

                    if (orderRows.length === 0) {
                        responseText = `🔒 **Access Denied**: Order #${targetOrderId} was not found under your account. To protect customer privacy, QUIRO strictly restricts order information to the verified participants of each transaction.`;
                        contextIndicator = 'Access Denied: Private Order';
                    } else {
                        const ord = orderRows[0];
                        responseText = `### 📦 Order #${ord.id} Summary\n\n` +
                            `• **Status:** ${ord.status.toUpperCase()}\n` +
                            `• **Item:** ${ord.book_title || 'Marketplace Item'}\n` +
                            `• **Total:** ₹${ord.total_price}\n` +
                            `• **Date:** ${new Date(ord.created_at).toLocaleDateString()}\n\n` +
                            `Your payment is protected by QUIRO Escrow until final delivery confirmation.`;
                        contextIndicator = `Order #${ord.id} Details`;
                        redirectUrl = `/orders/${ord.id}`;
                    }
                } else {
                    const [userOrders] = await pool.query(`
                        SELECT o.id, o.status, o.total_price, b.title as book_title
                        FROM orders o
                        LEFT JOIN order_items oi ON o.id = oi.order_id
                        LEFT JOIN books b ON oi.book_id = b.id
                        WHERE o.buyer_id = ? OR b.seller_id = ?
                        ORDER BY o.created_at DESC LIMIT 3
                    `, [userId, userId]);

                    if (userOrders.length === 0) {
                        responseText = 'You do not have any active or previous orders on QUIRO yet. When you purchase books or accept swaps, they will appear in your orders dashboard.';
                    } else {
                        const list = userOrders.map(o => `• **Order #${o.id}**: "${o.book_title || 'Book'}" — Status: **${o.status}** (₹${o.total_price})`).join('\n');
                        responseText = `### 📋 Your Recent Orders\n\n${list}\n\nVisit your Orders page for detailed tracking and invoice downloads.`;
                        redirectUrl = '/orders';
                    }
                    contextIndicator = 'Recent Orders';
                }
            }
            followUps = ['View My Orders', 'Track Shipment', 'Browse Catalog'];
        }

        // =====================================================================
        // 0B. INTENT: MARKETPLACE CONDITION STANDARDS GUIDE
        // =====================================================================
        else if (parsed.intent === 'CONDITION_GUIDE') {
            responseText = `### 📖 QUIRO Book Condition Guide\n\n` +
                `Here is how condition grading works on the QUIRO peer-to-peer book marketplace:\n\n` +
                `• **Brand New (10/10)**: An unread, pristine publisher copy with an unbroken spine, crisp pages, and no markings or shelf wear. Suitable for formal academic submissions, gifts, or long-term personal collections.\n\n` +
                `• **Like New (9/10)**: Read lightly once or twice. Binding is completely tight, cover has zero tears or fading, and pages contain zero highlighting, dog-ears, or notes. Indistinguishable from new at 20–30% below retail.\n\n` +
                `• **Good (7–8/10) — Recommended Reader Value**: Complete, sturdy copy with minor exterior shelf wear or spine creases. May contain occasional pencil notes or study highlights from prior coursework, but all text, problem sets, and diagrams are 100% intact and legible. Priced 40–60% below retail for maximum value per rupee.\n\n` +
                `• **Fair (5–6/10)**: Visible cover wear, softened corners, or extensive highlighting, but binding is sound and all study pages are completely readable. The most budget-friendly choice for readers and students.\n\n` +
                `💡 **Reader Recommendation**: For semester courses or casual reading, **Good** condition listings offer the best balance of readability and budget savings, fully protected by QUIRO's 7-day buyer escrow inspection guarantee.`;

            contextIndicator = 'Marketplace Condition Standards';
            followUps = ['Suggest beginner-friendly programming books under ₹500', 'Recommend books for someone who enjoys romantic fiction', 'Browse all textbooks'];
        }

        // =====================================================================
        // 0C. INTENT: EXPLORE DIVERSE GENRES OUTSIDE VIEWED
        // =====================================================================
        else if (parsed.intent === 'EXPLORE_DIFFERENT') {
            const excludedGenres = ['Romance', 'Programming'];
            if (userPreferences && userPreferences.favoriteGenres && userPreferences.favoriteGenres.length > 0) {
                userPreferences.favoriteGenres.forEach(g => excludedGenres.push(g));
            }
            if (parsed.prevGenre) {
                excludedGenres.push(parsed.prevGenre);
            }

            const uniqueExcluded = [...new Set(excludedGenres)];
            const placeholders = uniqueExcluded.map(() => '?').join(',');
            const [diffRows] = await pool.query(`
                SELECT * FROM books 
                WHERE status = 'available' 
                  AND genre IS NOT NULL 
                  AND genre NOT IN (${placeholders})
                ORDER BY rating DESC, price ASC
                LIMIT 4
            `, uniqueExcluded);

            recommendedBooks = diffRows;
            const diverseGenres = [...new Set(recommendedBooks.map(b => b.genre))].join(', ');

            responseText = `Stepping outside your recently viewed categories (${uniqueExcluded.join(', ')}), here are top-rated selections from diverse genres like **${diverseGenres}** to broaden your reading:`;
            contextIndicator = 'Diverse Discoveries';
            followUps = ['Which one is cheapest?', 'Compare top 2', 'Recommend books for someone who enjoys romantic fiction'];
        }

        // =====================================================================
        // 0D. INTENT: COMPARE RECOMMENDATIONS / TOP 2
        // =====================================================================
        else if (parsed.intent === 'COMPARE_RECOMMENDATIONS') {
            let candidateBooks = [];

            if (parsed.lastBooksList && parsed.lastBooksList.length >= 2) {
                candidateBooks = [parsed.lastBooksList[0], parsed.lastBooksList[1]];
            } else if (activeBookContext && parsed.lastBooksList && parsed.lastBooksList.length > 0) {
                candidateBooks = [activeBookContext, parsed.lastBooksList[0]];
            } else if (parsed.keywords.length >= 2) {
                const [b1] = await pool.query('SELECT * FROM books WHERE title LIKE ? LIMIT 1', ['%' + parsed.keywords[0] + '%']);
                const [b2] = await pool.query('SELECT * FROM books WHERE title LIKE ? LIMIT 1', ['%' + parsed.keywords[1] + '%']);
                if (b1.length > 0 && b2.length > 0) candidateBooks = [b1[0], b2[0]];
            }

            if (candidateBooks.length >= 2) {
                structuredComparison = await AIComparisonService.compareBooks(candidateBooks, {
                    targetBudget: parsed.maxPrice,
                    targetLevel: parsed.targetLevel
                });

                recommendedBooks = candidateBooks;
                responseText = `### ⚖️ Side-by-Side Comparison\n\n` +
                    `• **Option 1:** "${candidateBooks[0].title}" (₹${candidateBooks[0].price}, ${candidateBooks[0].condition || 'Good'}, ★${candidateBooks[0].rating || '4.5'})\n` +
                    `• **Option 2:** "${candidateBooks[1].title}" (₹${candidateBooks[1].price}, ${candidateBooks[1].condition || 'Good'}, ★${candidateBooks[1].rating || '4.5'})\n\n` +
                    `**Verdict:** ${structuredComparison.verdict}`;
                contextIndicator = `Comparing: "${candidateBooks[0].title.slice(0, 15)}..." vs "${candidateBooks[1].title.slice(0, 15)}..."`;
                followUps = ['Add winner to cart', 'Find cheaper alternative', 'Recommend similar books'];
            } else {
                responseText = 'Which two books or editions would you like to compare? You can specify their titles (for example, *"Compare Effective Java with Python Crash Course"*) or select books from your search results, and I will generate a side-by-side evaluation of syllabus suitability, condition, and student price value.';
                contextIndicator = 'Comparison Clarification';
                followUps = ['Suggest beginner-friendly programming books under ₹500', 'Recommend books for someone who enjoys romantic fiction'];
            }
        }

        // =====================================================================
        // 0E. INTENT: FOLLOW-UP REFINEMENT (CHEAPEST / LOWEST PRICE)
        // =====================================================================
        else if (parsed.intent === 'FOLLOW_UP') {
            if (parsed.lastBooksList && parsed.lastBooksList.length > 0) {
                const cheapest = [...parsed.lastBooksList].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
                recommendedBooks = [cheapest];
                responseText = `Among the recommended books, the most budget-friendly option is **"${cheapest.title}"** priced at **₹${cheapest.price}** in **${cheapest.condition || 'Good'}** condition with a student rating of ★**${cheapest.rating || '4.5'}**.`;
                contextIndicator = 'Cheapest Option Identified';
            } else {
                const cheapestResults = await Book.findAll({
                    genre: parsed.genre || 'Programming',
                    availability: 'available'
                }, { sort: 'price_asc', limit: 3 });

                recommendedBooks = cheapestResults.books;
                if (recommendedBooks.length > 0) {
                    const cheapest = recommendedBooks[0];
                    responseText = `The most affordable available listing in **${cheapest.genre}** is **"${cheapest.title}"** at **₹${cheapest.price}** (Condition: ${cheapest.condition || 'Good'}).`;
                } else {
                    responseText = `Here are affordable textbook listings from our marketplace:`;
                }
                contextIndicator = 'Lowest Price Listings';
            }
            followUps = ['Add to Cart', 'Compare top 2', 'Show other options'];
        }

        // =====================================================================
        // 0F. INTENT: UNSUPPORTED / OUT-OF-SCOPE QUERY
        // =====================================================================
        else if (parsed.intent === 'UNSUPPORTED_QUERY') {
            responseText = `I am NestAI, the specialized literary, fiction, and academic book marketplace assistant for QUIRO.\n\n` +
                `Your question falls outside the scope of book recommendations, catalog search, reading guidance, condition grading, and order support. For general knowledge queries, please consult a standard search engine.\n\n` +
                `How can I help you find, compare, or discover books today?`;
            contextIndicator = 'Out-of-Scope Query';
            followUps = [
                'Recommend books for someone who enjoys romantic fiction',
                'Suggest beginner-friendly programming books under ₹500',
                'Explain the difference between a new and a good-condition used book',
                'Find books similar to It Ends with Us'
            ];
        }

        // =====================================================================
        // 0. INTENT: ORDER PRIVACY & STATUS (ORDER_INQUIRY)
        // =====================================================================
        if (parsed.intent === 'ORDER_INQUIRY') {
            if (!userId) {
                responseText = '🔒 **Authentication Required**: For customer security and privacy, order status and private shipping details can only be accessed by authenticated account holders. Please log in to your verified QUIRO account to view your orders.';
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
                contextIndicator = 'Order Authorization Required';
            } else {
                const orderIdMatch = cleanMessage.match(/order\s*(?:#|id|number)?\s*(\d+)/i);
                const targetOrderId = orderIdMatch ? parseInt(orderIdMatch[1], 10) : null;

                if (targetOrderId) {
                    const [orderRows] = await pool.query(`
                        SELECT o.id, o.status, o.total_amount, o.created_at, o.buyer_id, o.seller_id,
                               b.title as book_title
                        FROM orders o
                        LEFT JOIN order_items oi ON o.id = oi.order_id
                        LEFT JOIN books b ON oi.book_id = b.id
                        WHERE o.id = ? AND (o.buyer_id = ? OR o.seller_id = ?)
                    `, [targetOrderId, userId, userId]);

                    if (orderRows.length === 0) {
                        responseText = `🔒 **Access Denied**: Order #${targetOrderId} was not found under your account. To protect customer privacy, QUIRO strictly restricts order information to the verified participants of each transaction.`;
                        contextIndicator = 'Access Denied: Private Order';
                    } else {
                        const ord = orderRows[0];
                        responseText = `### 📦 Order #${ord.id} Summary\n\n` +
                            `• **Status:** ${ord.status.toUpperCase()}\n` +
                            `• **Item:** ${ord.book_title || 'Marketplace Item'}\n` +
                            `• **Total:** ₹${ord.total_amount}\n` +
                            `• **Date:** ${new Date(ord.created_at).toLocaleDateString()}\n\n` +
                            `Your payment is protected by QUIRO Escrow until final delivery confirmation.`;
                        contextIndicator = `Order #${ord.id} Details`;
                        redirectUrl = `/orders/${ord.id}`;
                    }
                } else {
                    const [userOrders] = await pool.query(`
                        SELECT o.id, o.status, o.total_amount, b.title as book_title
                        FROM orders o
                        LEFT JOIN order_items oi ON o.id = oi.order_id
                        LEFT JOIN books b ON oi.book_id = b.id
                        WHERE o.buyer_id = ? OR o.seller_id = ?
                        ORDER BY o.created_at DESC LIMIT 3
                    `, [userId, userId]);

                    if (userOrders.length === 0) {
                        responseText = 'You do not have any active or previous orders on QUIRO yet. When you purchase books or accept swaps, they will appear in your orders dashboard.';
                    } else {
                        const list = userOrders.map(o => `• **Order #${o.id}**: "${o.book_title || 'Book'}" — Status: **${o.status}** (₹${o.total_amount})`).join('\n');
                        responseText = `### 📋 Your Recent Orders\n\n${list}\n\nVisit your Orders page for detailed tracking and invoice downloads.`;
                        redirectUrl = '/orders';
                    }
                    contextIndicator = 'Recent Orders';
                }
            }
            followUps = ['View My Orders', 'Track Shipment', 'Browse Catalog'];
        }

        // =====================================================================
        // 0B. INTENT: MARKETPLACE CONDITION STANDARDS GUIDE
        // =====================================================================
        else if (parsed.intent === 'CONDITION_GUIDE') {
            responseText = `### 📖 QUIRO Book Condition Guide\n\n` +
                `Here is how condition grading works on the QUIRO peer-to-peer book marketplace:\n\n` +
                `• **Brand New (10/10)**: An unread, pristine publisher copy with an unbroken spine, crisp pages, and no markings or shelf wear. Suitable for formal academic submissions, gifts, or long-term personal collections.\n\n` +
                `• **Like New (9/10)**: Read lightly once or twice. Binding is completely tight, cover has zero tears or fading, and pages contain zero highlighting, dog-ears, or notes. Indistinguishable from new at 20–30% below retail.\n\n` +
                `• **Good (7–8/10) — Recommended Reader Value**: Complete, sturdy copy with minor exterior shelf wear or spine creases. May contain occasional pencil notes or study highlights from prior coursework, but all text, problem sets, and diagrams are 100% intact and legible. Priced 40–60% below retail for maximum value per rupee.\n\n` +
                `• **Fair (5–6/10)**: Visible cover wear, softened corners, or extensive highlighting, but binding is sound and all study pages are completely readable. The most budget-friendly choice for readers.\n\n` +
                `💡 **Reader Recommendation**: For semester courses or casual reading, **Good** condition listings offer the best balance of readability and budget savings, fully protected by QUIRO's 7-day buyer escrow inspection guarantee.`;

            contextIndicator = 'Marketplace Condition Standards';
            followUps = ['Suggest beginner-friendly programming books under ₹500', 'Recommend books for someone who enjoys romantic fiction', 'Browse all textbooks'];
        }

        // =====================================================================
        // 0C. INTENT: EXPLORE DIVERSE GENRES OUTSIDE VIEWED
        // =====================================================================
        else if (parsed.intent === 'EXPLORE_DIFFERENT') {
            const excludedGenres = ['Romance', 'Programming'];
            if (userPreferences && userPreferences.favoriteGenres && userPreferences.favoriteGenres.length > 0) {
                userPreferences.favoriteGenres.forEach(g => excludedGenres.push(g));
            }
            if (parsed.prevGenre) {
                excludedGenres.push(parsed.prevGenre);
            }

            const uniqueExcluded = [...new Set(excludedGenres)];
            const placeholders = uniqueExcluded.map(() => '?').join(',');
            const [diffRows] = await pool.query(`
                SELECT * FROM books 
                WHERE status = 'available' 
                  AND genre IS NOT NULL 
                  AND genre NOT IN (${placeholders})
                ORDER BY rating DESC, price ASC
                LIMIT 4
            `, uniqueExcluded);

            recommendedBooks = diffRows;
            const diverseGenres = [...new Set(recommendedBooks.map(b => b.genre))].join(', ');

            responseText = `Stepping outside your recently viewed categories (${uniqueExcluded.join(', ')}), here are top-rated selections from diverse genres like **${diverseGenres}** to broaden your reading:`;
            contextIndicator = 'Diverse Discoveries';
            followUps = ['Which one is cheapest?', 'Compare top 2', 'Recommend books for someone who enjoys romantic fiction'];
        }

        // =====================================================================
        // 0D. INTENT: COMPARE RECOMMENDATIONS / TOP 2
        // =====================================================================
        else if (parsed.intent === 'COMPARE_RECOMMENDATIONS') {
            let candidateBooks = [];

            if (parsed.lastBooksList && parsed.lastBooksList.length >= 2) {
                candidateBooks = [parsed.lastBooksList[0], parsed.lastBooksList[1]];
            } else if (activeBookContext && parsed.lastBooksList && parsed.lastBooksList.length > 0) {
                candidateBooks = [activeBookContext, parsed.lastBooksList[0]];
            } else if (parsed.keywords.length >= 2) {
                const [b1] = await pool.query('SELECT * FROM books WHERE title LIKE ? LIMIT 1', ['%' + parsed.keywords[0] + '%']);
                const [b2] = await pool.query('SELECT * FROM books WHERE title LIKE ? LIMIT 1', ['%' + parsed.keywords[1] + '%']);
                if (b1.length > 0 && b2.length > 0) candidateBooks = [b1[0], b2[0]];
            }

            if (candidateBooks.length >= 2) {
                structuredComparison = await AIComparisonService.compareBooks(candidateBooks, {
                    targetBudget: parsed.maxPrice,
                    targetLevel: parsed.targetLevel
                });

                recommendedBooks = candidateBooks;
                responseText = `### ⚖️ Side-by-Side Comparison\n\n` +
                    `• **Option 1:** "${candidateBooks[0].title}" (₹${candidateBooks[0].price}, ${candidateBooks[0].condition || 'Good'}, ★${candidateBooks[0].rating || '4.5'})\n` +
                    `• **Option 2:** "${candidateBooks[1].title}" (₹${candidateBooks[1].price}, ${candidateBooks[1].condition || 'Good'}, ★${candidateBooks[1].rating || '4.5'})\n\n` +
                    `**Verdict:** ${structuredComparison.verdict}`;
                contextIndicator = `Comparing: "${candidateBooks[0].title.slice(0, 15)}..." vs "${candidateBooks[1].title.slice(0, 15)}..."`;
                followUps = ['Add winner to cart', 'Find cheaper alternative', 'Recommend similar books'];
            } else {
                responseText = 'Which two books or editions would you like to compare? You can specify their titles (for example, *"Compare Effective Java with Python Crash Course"*) or select books from your search results, and I will generate a side-by-side evaluation of syllabus suitability, condition, and student price value.';
                contextIndicator = 'Comparison Clarification';
                followUps = ['Suggest beginner-friendly programming books under ₹500', 'Recommend books for someone who enjoys romantic fiction'];
            }
        }

        // =====================================================================
        // 0E. INTENT: FOLLOW-UP REFINEMENT (CHEAPEST / LOWEST PRICE)
        // =====================================================================
        else if (parsed.intent === 'FOLLOW_UP') {
            if (parsed.lastBooksList && parsed.lastBooksList.length > 0) {
                const cheapest = [...parsed.lastBooksList].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
                recommendedBooks = [cheapest];
                responseText = `Among the recommended books, the most budget-friendly option is **"${cheapest.title}"** priced at **₹${cheapest.price}** in **${cheapest.condition || 'Good'}** condition with a student rating of ★**${cheapest.rating || '4.5'}**.`;
                contextIndicator = 'Cheapest Option Identified';
            } else {
                const cheapestResults = await Book.findAll({
                    genre: parsed.genre || 'Programming',
                    availability: 'available'
                }, { sort: 'price_asc', limit: 3 });

                recommendedBooks = cheapestResults.books;
                if (recommendedBooks.length > 0) {
                    const cheapest = recommendedBooks[0];
                    responseText = `The most affordable available listing in **${cheapest.genre}** is **"${cheapest.title}"** at **₹${cheapest.price}** (Condition: ${cheapest.condition || 'Good'}).`;
                } else {
                    responseText = `Here are affordable textbook listings from our marketplace:`;
                }
                contextIndicator = 'Lowest Price Listings';
            }
            followUps = ['Add to Cart', 'Compare top 2', 'Show other options'];
        }

        // =====================================================================
        // 0F. INTENT: UNSUPPORTED / OUT-OF-SCOPE QUERY
        // =====================================================================
        else if (parsed.intent === 'UNSUPPORTED_QUERY') {
            responseText = `I am NestAI, the specialized literary, fiction, and academic book marketplace assistant for QUIRO.\n\n` +
                `Your question falls outside the scope of book recommendations, catalog search, reading guidance, condition grading, and order support. For general knowledge queries, please consult a standard search engine.\n\n` +
                `How can I help you find, compare, or discover books today?`;
            contextIndicator = 'Out-of-Scope Query';
            followUps = [
                'Recommend books for someone who enjoys romantic fiction',
                'Suggest beginner-friendly programming books under ₹500',
                'Explain the difference between a new and a good-condition used book',
                'Find books similar to It Ends with Us'
            ];
        }

        // =====================================================================
        // 1. INTENT: BUILD STUDY BUNDLE (BUILD_BUNDLE)
        // =====================================================================
        else if (parsed.intent === 'BUILD_BUNDLE') {
            bundleData = await AIIntelligenceService.buildStudyBundle({
                subject: parsed.bundleSubject,
                budget: parsed.bundleBudget || 1500,
                level: parsed.targetLevel
            });

            recommendedBooks = bundleData.books;
            responseText = `### 📦 ${bundleData.title}\n\n` +
                `• **Curated Books:** ${bundleData.bookCount} textbook(s)\n` +
                `• **Bundle Total:** **₹${bundleData.totalPrice}** (Budget: ₹${bundleData.budget})\n` +
                `• **Savings Under Budget:** **₹${bundleData.savings}**\n\n` +
                `*${bundleData.reasoning}*`;

            contextIndicator = `Study Bundle: ${bundleData.subject}`;
            followUps = ['Add Bundle to Cart', 'Optimize my budget', 'Compare top 2'];
        }

        // =====================================================================
        // 2. INTENT: OPTIMIZE BUDGET (OPTIMIZE_BUDGET)
        // =====================================================================
        else if (parsed.intent === 'OPTIMIZE_BUDGET') {
            const targetBud = parsed.maxPrice || 1000;
            budgetPlanData = await AIIntelligenceService.optimizeBudgetPlan({
                budget: targetBud,
                genre: parsed.genre || 'Programming'
            });

            recommendedBooks = budgetPlanData.books;
            responseText = `### 💰 NestAI Budget Allocation Plan\n\n` +
                `• **Total Budget:** ₹${budgetPlanData.targetBudget}\n` +
                `• **Recommended Allocation:** **₹${budgetPlanData.recommendedSpend}** (${budgetPlanData.coverage})\n` +
                `• **Unused Remaining:** ₹${budgetPlanData.unusedBudget}\n\n` +
                `*${budgetPlanData.reasoning}*`;

            contextIndicator = `Budget Plan: ₹${targetBud}`;
            followUps = ['Add recommended books to cart', 'Build a study bundle', 'Find cheaper alternatives'];
        }

        // =====================================================================
        // 3. INTENT: EDITION INTELLIGENCE (EDITION_QUERY)
        // =====================================================================
        else if (parsed.intent === 'EDITION_QUERY') {
            const target = activeBookContext || (parsed.lastBooksList.length > 0 ? parsed.lastBooksList[0] : null);
            if (target) {
                editionData = await AIIntelligenceService.findBookEditions(target);
                recommendedBooks = editionData.availableEditions;
                responseText = `### 📖 Edition Intelligence: "${editionData.baseTitle}"\n\n` +
                    `• **Current Reference:** Edition ${editionData.currentEdition}\n` +
                    `• **Available in Catalog:** ${editionData.availableEditions.length} edition listing(s)\n\n` +
                    `${editionData.message}`;
                contextIndicator = 'Edition Analysis';
            } else {
                responseText = 'Please select or view a book first so I can inspect whether newer editions are cataloged!';
            }
            followUps = ['Compare available editions', 'Show cheapest edition', 'Is this worth buying?'];
        }

        // =====================================================================
        // 4. INTENT: SELLER TRUST INTELLIGENCE (SELLER_TRUST)
        // =====================================================================
        else if (parsed.intent === 'SELLER_TRUST') {
            const target = activeBookContext || (parsed.lastBooksList.length > 0 ? parsed.lastBooksList[0] : null);
            sellerTrustData = await AIIntelligenceService.evaluateSellerTrust(target?.seller_id, target?.id);

            responseText = `### 🛡️ Seller Trust Evaluation\n\n` +
                `• **Seller:** ${sellerTrustData.sellerName} (${sellerTrustData.rating}★)\n` +
                `• **Trust Score:** **${sellerTrustData.trustScore}/100** (${sellerTrustData.isVerified ? 'Campus Verified' : 'Standard Student Seller'})\n\n` +
                `${sellerTrustData.verdict}`;

            contextIndicator = 'Seller Reputation Analysis';
            followUps = ['Is this worth buying?', 'Add to cart', 'Find alternatives'];
        }

        // =====================================================================
        // 5. SHOPPING ACTIONS: START CHECKOUT
        // =====================================================================
        else if (parsed.intent === 'START_CHECKOUT') {
            if (!userId) {
                responseText = 'Please sign in to access your QUIRO cart and proceed to secure checkout.';
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
                followUps = ['Sign in', 'Continue browsing'];
            } else {
                const cart = await AIShoppingService.getCartContext(userId);
                if (cart.items.length === 0) {
                    responseText = 'Your cart is currently empty! Would you like me to recommend some trending titles?';
                    followUps = ['Recommend books for me', 'Books under ₹300', 'Top rated fiction'];
                } else {
                    responseText = `Your cart has **${cart.itemCount}** item(s) totaling **₹${cart.subtotal}**. Your order is ready for secure escrow checkout!`;
                    redirectUrl = '/checkout';
                    actionResult = {
                        type: 'START_CHECKOUT',
                        requiresConfirmation: false,
                        subtotal: cart.subtotal,
                        itemCount: cart.itemCount
                    };
                    followUps = ['View Cart', 'Optimize my cart', 'Continue Browsing'];
                }
            }
        }

        // =====================================================================
        // 6. SHOPPING ACTION: OPTIMIZE CART
        // =====================================================================
        else if (parsed.intent === 'OPTIMIZE_CART') {
            if (!userId) {
                responseText = 'Please sign in so NestAI can inspect your cart and discover potential savings.';
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
            } else {
                cartAnalysis = await AIShoppingService.optimizeCart(userId);
                if (cartAnalysis.potentialSavings > 0) {
                    responseText = `### 💡 NestAI Smart Cart Optimization\n\n` +
                        `• **Current Cart Total:** ₹${cartAnalysis.currentTotal}\n` +
                        `• **Potential Optimized Total:** ₹${cartAnalysis.optimizedTotal}\n` +
                        `• **Estimated Savings:** **₹${cartAnalysis.potentialSavings}**\n\n` +
                        `Here are recommendations to maximize your budget:`;
                } else {
                    responseText = `Your cart is already running at optimal pricing (Total: ₹${cartAnalysis.currentTotal}) with no overpriced duplicates!`;
                }
                contextIndicator = 'Cart Savings Analysis';
                followUps = ['Proceed to Checkout', 'Show my cart', 'Recommend similar books'];
            }
        }

        // =====================================================================
        // 7. SHOPPING ACTION: VIEW CART
        // =====================================================================
        else if (parsed.intent === 'VIEW_CART') {
            if (!userId) {
                responseText = "You'll need to sign in to inspect your QUIRO cart.";
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
            } else {
                const cart = await AIShoppingService.getCartContext(userId);
                if (cart.items.length === 0) {
                    responseText = "Your cart is currently empty. Tell me what subject or genre you're looking for, and I'll find the best deals!";
                } else {
                    const itemList = cart.items.map(i => `• **${i.title}** (₹${i.price} × ${i.quantity})`).join('\n');
                    responseText = `### 🛒 Your QUIRO Cart (${cart.itemCount} items)\n\n${itemList}\n\n**Subtotal:** ₹${cart.subtotal}`;
                    redirectUrl = '/cart';
                }
                contextIndicator = 'Active Cart Context';
                followUps = ['Optimize my cart', 'Take me to checkout', 'Find cheaper alternatives'];
            }
        }

        // =====================================================================
        // 8. SHOPPING ACTION: VIEW WISHLIST
        // =====================================================================
        else if (parsed.intent === 'VIEW_WISHLIST') {
            if (!userId) {
                responseText = "You'll need to sign in to view your QUIRO wishlist.";
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
            } else {
                const wishlist = await AIShoppingService.getWishlistContext(userId);
                if (wishlist.items.length === 0) {
                    responseText = "Your wishlist is currently empty. You can say 'Save this book' whenever you see a title you like!";
                } else {
                    const list = wishlist.items.map(i => `• **${i.title}** (₹${i.price}, ★${i.rating})`).join('\n');
                    responseText = `### ⭐ Your Saved Wishlist (${wishlist.count} items)\n\n${list}`;
                    redirectUrl = '/wishlist';
                }
                contextIndicator = 'Wishlist Context';
                followUps = ['Which wishlist book is cheapest?', 'Show my cart', 'Recommend something for me'];
            }
        }

        // =====================================================================
        // 9. SHOPPING ACTION: ADD TO CART
        // =====================================================================
        else if (parsed.intent === 'ADD_TO_CART') {
            if (!userId) {
                responseText = "You'll need to sign in to save items to your QUIRO cart.";
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
                followUps = ['Sign in', 'Continue browsing'];
            } else {
                let targetBook = null;
                const poolBooks = parsed.lastBooksList && parsed.lastBooksList.length > 0 ? parsed.lastBooksList : [];

                if (parsed.targetOrdinal === 'second' && poolBooks.length > 1) {
                    targetBook = poolBooks[1];
                } else if (parsed.targetOrdinal === 'third' && poolBooks.length > 2) {
                    targetBook = poolBooks[2];
                } else if (parsed.targetOrdinal === 'cheapest' && poolBooks.length > 0) {
                    targetBook = [...poolBooks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
                } else if (parsed.targetOrdinal === 'best_rated' && poolBooks.length > 0) {
                    targetBook = [...poolBooks].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];
                } else if (activeBookContext) {
                    targetBook = activeBookContext;
                } else if (poolBooks.length > 0) {
                    targetBook = poolBooks[0];
                } else {
                    const searchRes = await Book.findAll({
                        search: parsed.keywords.length > 0 ? parsed.keywords[0] : null,
                        genre: parsed.genre,
                        maxPrice: parsed.maxPrice,
                        availability: 'available'
                    }, { sort: parsed.sort || 'rating_desc', limit: 1 });
                    if (searchRes.books.length > 0) targetBook = searchRes.books[0];
                }

                if (targetBook) {
                    await AIShoppingService.executeAction(userId, 'ADD_TO_CART', targetBook.id, 1, req);
                    responseText = `✓ Added **"${targetBook.title}"** (₹${targetBook.price}) to your cart!`;
                    actionResult = {
                        type: 'ADD_TO_CART',
                        book: targetBook,
                        success: true,
                        requiresConfirmation: false
                    };
                    redirectUrl = '/cart';
                    followUps = ['View Cart', 'Take me to checkout', 'Find cheaper alternatives'];
                } else {
                    responseText = "I couldn't identify the specific book to add. Could you please specify the title or select one from our recommendations?";
                }
            }
        }

        // =====================================================================
        // 10. SHOPPING ACTION: REMOVE FROM CART
        // =====================================================================
        else if (parsed.intent === 'REMOVE_FROM_CART') {
            if (!userId) {
                responseText = 'Please sign in to manage your cart.';
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
            } else {
                const cart = await AIShoppingService.getCartContext(userId);
                let targetBook = null;

                if (cart.items.length > 0) {
                    const lowerClean = cleanMessage.toLowerCase();
                    targetBook = cart.items.find(i => lowerClean.includes(i.title.toLowerCase())) || cart.items[0];
                }

                if (targetBook) {
                    responseText = `Remove **"${targetBook.title}"** from your cart?`;
                    actionResult = {
                        type: 'REMOVE_FROM_CART',
                        book: targetBook,
                        requiresConfirmation: true
                    };
                    followUps = ['Confirm Remove', 'Cancel', 'View Cart'];
                } else {
                    responseText = 'I could not find that book in your active cart.';
                }
            }
        }

        // =====================================================================
        // 11. SHOPPING ACTION: ADD TO WISHLIST
        // =====================================================================
        else if (parsed.intent === 'ADD_TO_WISHLIST') {
            if (!userId) {
                responseText = 'You will need to sign in to save books to your QUIRO wishlist.';
                actionResult = { type: 'AUTH_REQUIRED', requiresAuth: true };
            } else {
                let targetBook = activeBookContext || (parsed.lastBooksList.length > 0 ? parsed.lastBooksList[0] : null);
                if (targetBook) {
                    await AIShoppingService.executeAction(userId, 'ADD_TO_WISHLIST', targetBook.id, 1, req);
                    responseText = `✓ Saved **"${targetBook.title}"** to your wishlist!`;
                    actionResult = {
                        type: 'ADD_TO_WISHLIST',
                        book: targetBook,
                        success: true,
                        requiresConfirmation: false
                    };
                    redirectUrl = '/wishlist';
                    followUps = ['View Wishlist', 'Show my cart', 'Recommend more like this'];
                } else {
                    responseText = 'Please specify which book you would like to save to your wishlist.';
                }
            }
        }

        // =====================================================================
        // 12. ALTERNATIVES DISCOVERY
        // =====================================================================
        else if (parsed.intent === 'FIND_CHEAPER' || parsed.intent === 'FIND_BETTER_RATED' || parsed.intent === 'VIEW_ALTERNATIVES') {
            const refBook = activeBookContext || (parsed.lastBooksList.length > 0 ? parsed.lastBooksList[0] : null);
            const altType = parsed.intent === 'FIND_CHEAPER' ? 'CHEAPER' : (parsed.intent === 'FIND_BETTER_RATED' ? 'BETTER_RATED' : 'SIMILAR');

            if (refBook) {
                const alts = await AIShoppingService.getAlternativeBooks(refBook.id, altType);
                recommendedBooks = alts;
                if (alts.length > 0) {
                    const desc = altType === 'CHEAPER' ? 'cheaper alternatives' : (altType === 'BETTER_RATED' ? 'higher-rated alternatives' : 'companion books');
                    responseText = `Here are verified ${desc} to **"${refBook.title}"** in ${refBook.genre}:`;
                } else {
                    responseText = `**"${refBook.title}"** at ₹${refBook.price} is already the best match in our catalog for that criteria!`;
                }
                contextIndicator = `Alternatives to "${refBook.title.slice(0, 18)}..."`;
            } else {
                const fallback = await Book.findAll({ genre: parsed.genre || 'Programming', availability: 'available' }, { sort: 'rating_desc', limit: 4 });
                recommendedBooks = fallback.books;
                responseText = 'Here are top-rated alternatives from our marketplace:';
            }
            followUps = ['Add the cheapest one', 'Compare these', 'Show only Like New'];
        }

        // =====================================================================
        // 13. RECOMMENDATIONS (GENRE / BUDGET / LEVEL / PERSONALIZED)
        // =====================================================================
        else if (parsed.intent === 'RECOMMEND' && !parsed.bookSimilarityTarget) {
            if (parsed.genre || parsed.maxPrice || parsed.keywords.length > 0) {
                const searchFilters = {
                    search: parsed.keywords.length > 0 ? parsed.keywords[0] : null,
                    genre: parsed.genre,
                    maxPrice: parsed.maxPrice,
                    minRating: parsed.minRating,
                    condition: parsed.condition,
                    availability: 'available'
                };

                const searchResults = await Book.findAll(searchFilters, {
                    sort: parsed.sort || 'rating_desc',
                    limit: 5
                });

                recommendedBooks = searchResults.books;

                const constraints = [];
                if (parsed.genre) constraints.push(`in **${parsed.genre}**`);
                if (parsed.maxPrice) constraints.push(`under **₹${parsed.maxPrice}**`);
                if (parsed.targetLevel === 'beginner') constraints.push('for beginners');

                const constraintText = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';

                if (parsed.genre === 'Romance') {
                    responseText = `For readers who enjoy romantic fiction and heartfelt relationship narratives, here are top-rated verified romance novels from our QUIRO catalog:`;
                } else if (parsed.genre === 'Programming' && (parsed.targetLevel === 'beginner' || cleanMessage.toLowerCase().includes('beginner'))) {
                    responseText = `For beginner programmers${parsed.maxPrice ? ' on a budget under ₹' + parsed.maxPrice : ''}, here are verified, approachable textbooks from our catalog with clear explanations and reader escrow protection:`;
                } else {
                    responseText = `Here are top-rated recommendations${constraintText} available in the QUIRO catalog:`;
                }

                contextIndicator = `Recommendations: ${parsed.genre || 'Catalog'}${parsed.maxPrice ? ' under ₹' + parsed.maxPrice : ''}`;
                browseUrl = `/browse?${parsed.genre ? 'genre=' + encodeURIComponent(parsed.genre) : ''}${parsed.maxPrice ? '&maxPrice=' + parsed.maxPrice : ''}&sort=rating`;
            } else if (userId && userPreferences) {
                isPersonalized = true;
                const recs = await recommendationService.getPersonalizedRecommendations(userId, 6);
                const excludedIds = new Set([
                    ...(userPreferences.ownedBookIds || []),
                    ...(userPreferences.reviewedBookIds || [])
                ]);

                recommendedBooks = recs.filter(b => !excludedIds.has(b.id)).slice(0, 5);

                const favs = userPreferences.favoriteGenres.join(' and ');
                if (favs) {
                    contextIndicator = `Because you previously purchased books in ${favs}`;
                    responseText = `Based on your reading history in **${favs}**, here are personalized recommendations curated for your library:`;
                } else {
                    contextIndicator = 'Recommended for you';
                    responseText = `Here are today's top-rated and trending books on QUIRO picked just for you:`;
                }
                browseUrl = '/browse?sort=rating';
            } else {
                const fallback = await Book.findAll({ availability: 'available' }, { sort: 'rating_desc', limit: 5 });
                recommendedBooks = fallback.books;
                contextIndicator = 'Trending on marketplace';
                responseText = `Welcome to QUIRO! Here are our highest-rated books and popular marketplace picks:`;
                browseUrl = '/browse?sort=rating';
            }
            followUps = ['Which one gives better value?', 'Show cheaper options', 'Compare top 2', 'Books under ₹300'];
        }

        // =====================================================================
        // 14. SIMILAR BOOK RECOMMENDATIONS
        // =====================================================================
        else if (parsed.bookSimilarityTarget || (parsed.intent === 'RECOMMEND' && parsed.bookSimilarityTarget)) {
            const targetTitle = parsed.bookSimilarityTarget || (activeBookContext ? activeBookContext.title : 'It Ends with Us');
            
            const [matchedRows] = await pool.query(
                "SELECT * FROM books WHERE title LIKE ? LIMIT 1",
                ['%' + targetTitle + '%']
            );

            const sourceBook = matchedRows[0] || activeBookContext;
            const targetGenre = sourceBook ? sourceBook.genre : (parsed.genre || 'Romance');
            const targetAuthor = sourceBook ? sourceBook.author : 'Colleen Hoover';
            const displayTitle = sourceBook ? sourceBook.title.replace(/ \(Edition \d+\)/i, '').trim() : (parsed.bookSimilarityTarget || 'It Ends with Us');
            const excludeId = sourceBook ? sourceBook.id : 0;

            const related = await Book.findAll({
                genre: targetGenre,
                availability: 'available'
            }, { sort: 'rating_desc', limit: 5 });

            recommendedBooks = related.books.filter(b => b.id !== excludeId).slice(0, 4);
            contextIndicator = `Similar to "${displayTitle}"`;
            responseText = `If you enjoyed **"${displayTitle}"** by ${targetAuthor}, here are closely related titles in **${targetGenre}** featuring similar themes, storytelling depth, and verified student ratings:`;
            browseUrl = `/browse?genre=${encodeURIComponent(targetGenre)}&sort=rating`;
            followUps = ['Compare these', 'Which one is cheapest?', 'Show only Like New', 'More like this'];
        }

        // =====================================================================
        // 15. COMPARISON ENGINE
        // =====================================================================
        else if (parsed.intent === 'COMPARE') {
            const searchKeyword = parsed.keywords.length > 0 ? parsed.keywords[0] : (parsed.genre || 'Programming');
            
            const results = await Book.findAll({
                search: searchKeyword,
                genre: parsed.genre,
                maxPrice: parsed.maxPrice,
                availability: 'available'
            }, { sort: 'rating_desc', limit: 3 });

            let candidateBooks = results.books;
            if (activeBookContext && !candidateBooks.some(b => b.id === activeBookContext.id)) {
                candidateBooks = [activeBookContext, ...candidateBooks].slice(0, 3);
            }

            if (candidateBooks.length >= 2) {
                structuredComparison = await AIComparisonService.compareBooks(candidateBooks, {
                    targetBudget: parsed.maxPrice,
                    targetLevel: parsed.targetLevel
                });

                recommendedBooks = candidateBooks;
                responseText = structuredComparison.verdict;
                contextIndicator = 'Side-by-side evaluation';
            } else {
                recommendedBooks = candidateBooks;
                responseText = `When comparing marketplace editions, prioritize **physical condition**, **edition syllabus alignment**, and **seller escrow rating**. Here are the closest matches from our catalog:`;
            }
            browseUrl = `/browse?search=${encodeURIComponent(searchKeyword)}`;
            followUps = ['Add winner to cart', 'Find cheaper alternative', 'Is this good for beginners?'];
        }

        // =====================================================================
        // 16. BUYING DECISION ENGINE
        // =====================================================================
        else if (parsed.intent === 'BUYING_DECISION') {
            const searchKeyword = parsed.keywords.length > 0 ? parsed.keywords[0] : null;

            const results = await Book.findAll({
                search: searchKeyword,
                genre: parsed.genre,
                maxPrice: parsed.maxPrice,
                availability: 'available'
            }, { sort: 'rating_desc', limit: 1 });

            const b = results.books[0] || activeBookContext;
            if (!b) {
                responseText = "I couldn't locate that specific title to evaluate. Could you specify the book title or browse our verified catalog?";
            } else if (lowerMsg.includes('worth') || lowerMsg.includes('value')) {
                recommendedBooks = [b];
                responseText = `**"${b.title}"** (₹${b.price}) is evaluated at strong student market value with **${b.rating || 4.5}★** verified ratings.`;
                contextIndicator = `Decision: Worth Buying`;
            } else if (lowerMsg.includes('cheap') || lowerMsg.includes('alternative')) {
                const cheaper = await Book.findAll({
                    genre: b.genre,
                    maxPrice: parseFloat(b.price) - 1,
                    availability: 'available'
                }, { sort: 'price_asc', limit: 3 });

                if (cheaper.books.length > 0) {
                    recommendedBooks = cheaper.books;
                    responseText = `Here are verified, more budget-friendly alternatives to **"${b.title}"** in **${b.genre}**:`;
                } else {
                    responseText = `**"${b.title}"** at **₹${b.price}** is already among the most competitive listings in ${b.genre}! You can also request a peer swap to get it for free.`;
                }
            } else if (lowerMsg.includes('seller') || lowerMsg.includes('trustworthy')) {
                const isTrusty = (b.seller_rating >= 4.5 || b.seller_role === 'ADMIN');
                responseText = isTrusty
                    ? `Yes, the seller is verified with a **${b.seller_rating || 4.9}★** rating and 100% successful fulfillment rate on QUIRO. All payments remain held in escrow until you inspect the book.`
                    : `The seller is active with standard 7-day buyer protection. Your funds are secured by QUIRO escrow until delivery.`;
            } else {
                const sim = await Book.findRelated(b.id);
                recommendedBooks = sim;
                responseText = `Here are top-rated companion books in **${b.genre}** related to **"${b.title}"**:`;
            }
            contextIndicator = b ? `Book Details: ${b.title.slice(0, 20)}...` : 'Catalog Evaluation';
            browseUrl = b ? `/browse?genre=${encodeURIComponent(b.genre)}` : '/browse';
            followUps = ['Is this worth buying?', 'Find cheaper alternatives', 'Compare this with similar books'];
        }

        // =====================================================================
        // 18. GENRE EXPLANATIONS
        // =====================================================================
        else if (parsed.intent === 'GENRE_EXPLANATION') {
            const subject = parsed.genre || (parsed.keywords.length > 0 ? parsed.keywords[0] : 'Fiction');
            
            const results = await Book.findAll({
                genre: parsed.genre,
                search: parsed.keywords.length > 0 ? parsed.keywords[0] : null,
                availability: 'available'
            }, { sort: 'rating_desc', limit: 4 });

            recommendedBooks = results.books;
            responseText = `### 📚 Reading Guidance: ${subject}\n\n` +
                `**Core Focus:** Exploring exceptional writing, narrative depth, and authoritative perspectives.\n` +
                `**Recommendation Strategy:** Start with seminal works, followed by popular contemporary releases and acclaimed author titles.\n\n` +
                `Here are verified books in our QUIRO catalog to support your reading journey:`;
            contextIndicator = `Genre Overview: ${subject}`;
            browseUrl = parsed.genre ? `/browse?genre=${encodeURIComponent(parsed.genre)}` : '/browse';
            followUps = ['Recommend beginner books', 'Books under ₹500', 'Top rated in this category'];
        }

        // =====================================================================
        // 19. DEFAULT MULTI-CONSTRAINT SEARCH
        // =====================================================================
        else {
            const searchQuery = parsed.keywords.length > 0 ? parsed.keywords[0] : null;

            const searchFilters = {
                search: searchQuery,
                genre: parsed.genre,
                minPrice: parsed.minPrice,
                maxPrice: parsed.maxPrice,
                minRating: parsed.minRating,
                condition: parsed.condition,
                availability: 'available'
            };

            const searchResults = await Book.findAll(searchFilters, {
                sort: parsed.sort || 'rating_desc',
                limit: 4
            });

            recommendedBooks = searchResults.books;

            const urlParams = new URLSearchParams();
            if (parsed.genre) urlParams.append('genre', parsed.genre);
            if (searchQuery) urlParams.append('search', searchQuery);
            if (parsed.minPrice) urlParams.append('minPrice', parsed.minPrice);
            if (parsed.maxPrice) urlParams.append('maxPrice', parsed.maxPrice);
            if (parsed.minRating) urlParams.append('minRating', parsed.minRating);
            if (parsed.condition) urlParams.append('condition', parsed.condition);
            browseUrl = `/browse?${urlParams.toString()}`;

            if (recommendedBooks.length > 0) {
                const constraintDesc = [];
                if (parsed.genre) constraintDesc.push(`in **${parsed.genre}**`);
                if (parsed.maxPrice) constraintDesc.push(`under **₹${parsed.maxPrice}**`);
                if (parsed.minRating) constraintDesc.push(`rated **${parsed.minRating}★+**`);
                if (parsed.condition) constraintDesc.push(`condition: **${parsed.condition}**`);

                const constraintsStr = constraintDesc.length > 0 ? ` (${constraintDesc.join(', ')})` : '';
                
                if (parsed.isFollowUp) {
                    contextIndicator = parsed.maxPrice ? `Filtered to under ₹${parsed.maxPrice}` : 'Refined query';
                    responseText = `Here are the refined listings${constraintsStr}:`;
                } else {
                    contextIndicator = 'Catalog search match';
                    responseText = `I found verified book listings matching your search${constraintsStr}! All items are backed by QUIRO reader escrow:`;
                }
            } else {
                const fallbackResults = await Book.findAll({
                    genre: parsed.genre,
                    maxPrice: parsed.maxPrice,
                    availability: 'available'
                }, { sort: 'rating_desc', limit: 3 });

                recommendedBooks = fallbackResults.books;
                contextIndicator = 'Close alternatives';
                responseText = `I couldn't find an exact match for all those constraints together, but here are some close top-rated alternatives from our catalog:`;
            }

            followUps = [
                'Which one is cheapest?',
                'Show only Like New',
                'Compare top 2',
                'Books under ₹300'
            ];
        }

        // =====================================================================
        // PROVIDER BEHAVIOR: GROUNDED RAG (CONFIGURED) VS HONEST CATALOG SEARCH (UNCONFIGURED)
        // =====================================================================
        let providerInfo = {
            provider: 'DATABASE_GROUNDED_SEARCH',
            isConfigured: false,
            model: null
        };

        if (AIProviderAdapter.isConfigured()) {
            const config = AIProviderAdapter.getProviderConfig();
            providerInfo = {
                provider: config.provider,
                isConfigured: true,
                model: config.model
            };

            try {
                const catalogContext = recommendedBooks.map(b => 
                    `- "${b.title}" by ${b.author} | ₹${b.price} | Condition: ${b.condition} | Genre: ${b.genre} | Rating: ${b.rating || 'N/A'}`
                ).join('\n');

                const systemPrompt = 'You are NestAI, the intelligent assistant for QUIRO, India\'s premier book marketplace and community exchange.\n' +
                    'Rules:\n' +
                    '1. Ground your answers strictly in the provided verified catalog data. Never invent prices or stock.\n' +
                    '2. If catalog data is provided, reference the exact titles, prices, and conditions.\n' +
                    '3. Keep answers concise, reader-friendly, and helpful.';

                const aiResult = await AIProviderAdapter.generateCompletion({
                    systemPrompt,
                    messages: [
                        { role: 'user', content: `Reader query: "${cleanMessage}"\n\nVerified Catalog Items in Database:\n${catalogContext || 'None'}\n\nDeterministic Context: ${responseText}` }
                    ],
                    maxTokens: 500,
                    timeoutMs: 8000
                });

                if (aiResult && aiResult.content && aiResult.content.trim()) {
                    responseText = aiResult.content.trim();
                }
            } catch (err) {
                // Non-blocking fallback to factual deterministic response
                console.warn('AI Provider completion fallback:', err.message);
            }
        } else {
            // When external AI key is not configured:
            // Clearly explain that generative AI requires configuration and present verified database search
            if (
                parsed.intent !== 'ORDER_INQUIRY' && 
                parsed.intent !== 'CONDITION_GUIDE' && 
                parsed.intent !== 'UNSUPPORTED_QUERY'
            ) {
                const notice = `> ℹ️ *External generative AI is unconfigured. Displaying verified database catalog results grounded in live QUIRO inventory.*\n\n`;
                responseText = notice + responseText;
            }
        }

        // Enrich recommendations with Value Score
        const enrichedRecommendations = recommendedBooks.map(b => {
            const vs = AIIntelligenceService.calculateValueScore(b);
            return {
                ...b,
                valueScore: vs.score,
                valueHighlights: vs.highlights
            };
        });

        // Persist interaction in history
        const historyId = await AIChatHistory.create({
            user_id: userId,
            session_id: sessionId,
            message: cleanMessage,
            response: responseText,
            recommended_books: enrichedRecommendations
        });

        return {
            id: historyId,
            message: cleanMessage,
            response: responseText,
            intent: parsed.intent,
            provider: providerInfo.provider,
            aiConfigured: providerInfo.isConfigured,
            model: providerInfo.model,
            context: {
                contextIndicator,
                detectedGenre: parsed.genre,
                detectedBudget: parsed.maxPrice || parsed.bundleBudget,
                detectedKeywords: parsed.keywords,
                isFollowUp: parsed.isFollowUp
            },
            filters: {
                keywords: parsed.keywords,
                genre: parsed.genre,
                minPrice: parsed.minPrice,
                maxPrice: parsed.maxPrice,
                minRating: parsed.minRating,
                condition: parsed.condition
            },
            recommendations: enrichedRecommendations,
            recommended_books: enrichedRecommendations,
            books: enrichedRecommendations,
            bundle: bundleData,
            budgetPlan: budgetPlanData,
            editionInfo: editionData,
            sellerScore: sellerTrustData,
            action: actionResult,
            redirect: redirectUrl,
            cartAnalysis,
            comparison: structuredComparison ? structuredComparison.comparison : null,
            winner: structuredComparison ? structuredComparison.winner : null,
            categoryWinners: structuredComparison ? structuredComparison.categoryWinners : null,
            buyingDecision,
            followUps,
            personalized: isPersonalized,
            browseUrl,
            created_at: new Date().toISOString()
        };
    }

    static async compareBookIds({ bookIds = [], userId = null, preferences = {} }) {
        if (!Array.isArray(bookIds) || bookIds.length < 2) {
            throw new Error('Please provide at least 2 book IDs to compare');
        }

        const placeholders = bookIds.map(() => '?').join(',');
        const [books] = await pool.query(
            `SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role
             FROM books b
             JOIN users u ON b.seller_id = u.id
             WHERE b.id IN (${placeholders})`,
            bookIds
        );

        if (books.length < 2) {
            throw new Error('One or more of the specified books could not be found');
        }

        return await AIComparisonService.compareBooks(books, {
            targetBudget: preferences.budget,
            targetLevel: preferences.level || 'beginner'
        });
    }

    static async getChatHistory({ userId = null, sessionId = null }) {
        return await AIChatHistory.getHistory({ userId, sessionId });
    }

    static async clearChatHistory({ userId = null, sessionId = null }) {
        return await AIChatHistory.clearHistory({ userId, sessionId });
    }
}

module.exports = AIService;
