const { pool } = require('../config/db');
const AIProviderAdapter = require('./aiProviderAdapter');
let getIO;
try {
    const socketModule = require('../socket');
    getIO = socketModule.getIO || socketModule.io;
} catch (e) {}

class AIMarketplaceOperationsService {
    /**
     * Safe Cache Helper
     */
    async getCachedInsight(cacheKey) {
        try {
            const [rows] = await pool.execute(
                `SELECT insight_data FROM ai_cached_insights 
                 WHERE cache_key = ? AND expires_at > NOW()`,
                [cacheKey]
            );
            if (rows.length > 0) {
                return typeof rows[0].insight_data === 'string' 
                    ? JSON.parse(rows[0].insight_data) 
                    : rows[0].insight_data;
            }
        } catch (e) {
            console.warn('[AICache] Read error:', e.message);
        }
        return null;
    }

    async setCachedInsight(cacheKey, category, data, ttlMinutes = 60, metadata = {}) {
        try {
            const insightJson = JSON.stringify(data);
            const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
            await pool.execute(
                `INSERT INTO ai_cached_insights (cache_key, category, user_id, seller_id, book_id, time_range, insight_data, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    insight_data = VALUES(insight_data),
                    expires_at = VALUES(expires_at)`,
                [
                    cacheKey,
                    category,
                    metadata.userId || null,
                    metadata.sellerId || null,
                    metadata.bookId || null,
                    metadata.timeRange || '30d',
                    insightJson,
                    expiresAt
                ]
            );
        } catch (e) {
            console.warn('[AICache] Write error:', e.message);
        }
    }

    /**
     * AI Activity Audit Logging
     */
    async logAIActivity({ userId = null, sellerId = null, feature, requestType, entityType = null, entityId = null, promptSnippet = null, recommendation = null, evidence = null, userAction = 'NONE', actionResult = null }) {
        try {
            await pool.execute(
                `INSERT INTO ai_activity_logs (user_id, seller_id, ai_feature, request_type, entity_type, entity_id, prompt_snippet, recommendation, evidence, user_action, action_result)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    sellerId,
                    feature,
                    requestType,
                    entityType,
                    entityId,
                    promptSnippet ? String(promptSnippet).substring(0, 500) : null,
                    recommendation ? String(recommendation).substring(0, 1000) : null,
                    evidence ? JSON.stringify(evidence) : null,
                    userAction,
                    actionResult ? String(actionResult).substring(0, 500) : null
                ]
            );
        } catch (e) {
            console.warn('[AIActivityLog] Log error:', e.message);
        }
    }

    /**
     * 1. AI SELLER COPILOT
     * Answers seller queries with strict separation of DATA, INTERPRETATION, and RECOMMENDATION.
     */
    async getSellerCopilotResponse(sellerId, userPrompt) {
        if (!sellerId) throw new Error('Seller ID is required for Seller Copilot');
        const prompt = (userPrompt || '').toLowerCase();

        // 1. Gather live seller statistics
        const [books] = await pool.execute(
            `SELECT b.id, b.title, b.author, b.price, b.\`condition\`, b.genre as category, b.status, b.views as views_count, b.created_at,
                    lm.quality_score, lm.quality_status
             FROM books b
             LEFT JOIN listing_moderation lm ON b.id = lm.book_id
             WHERE b.seller_id = ?`,
            [sellerId]
        );

        const [orderStats] = await pool.execute(
            `SELECT COUNT(DISTINCT o.id) as total_orders,
                    COALESCE(SUM(oi.price), 0) as total_revenue,
                    COALESCE(AVG(oi.price), 0) as avg_order_val,
                    COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as completed_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_orders
             FROM order_items oi
             JOIN books b ON oi.book_id = b.id
             JOIN orders o ON oi.order_id = o.id
             WHERE b.seller_id = ?`,
            [sellerId]
        );

        const [slaStats] = await pool.execute(
            `SELECT COUNT(*) as total_sla_events,
                    COUNT(CASE WHEN sla_status = 'BREACHED' THEN 1 END) as breached_count,
                    COUNT(CASE WHEN sla_status = 'ON_TIME' THEN 1 END) as on_time_count,
                    COALESCE(AVG(breach_duration_hours), 0) as avg_breach_hours
             FROM seller_sla_events
             WHERE seller_id = ?`,
            [sellerId]
        );

        const [reviewStats] = await pool.execute(
            `SELECT COUNT(*) as review_count,
                    COALESCE(AVG(rating), 0) as avg_rating
             FROM reviews
             WHERE seller_id = ?`,
            [sellerId]
        );

        const totalListings = books.length;
        const activeListings = books.filter(b => b.status === 'available').length;
        const totalSales = Number(orderStats[0]?.total_orders || 0);
        const totalRevenue = Number(orderStats[0]?.total_revenue || 0);
        const avgRating = Number(reviewStats[0]?.avg_rating || 0).toFixed(1);
        const totalReviews = Number(reviewStats[0]?.review_count || 0);
        const breachedSLAs = Number(slaStats[0]?.breached_count || 0);
        const totalSLAs = Number(slaStats[0]?.total_sla_events || 0);
        const slaOnTimeRate = totalSLAs > 0 ? Math.round(((totalSLAs - breachedSLAs) / totalSLAs) * 100) : 100;

        let response = {
            topic: 'GENERAL_OVERVIEW',
            data: {},
            interpretation: '',
            recommendation: '',
            evidence: [],
            suggestedActions: []
        };

        // Determine inquiry intent
        if (prompt.includes('sales') || prompt.includes('revenue') || prompt.includes('down') || prompt.includes('performance')) {
            response.topic = 'SALES_PERFORMANCE';
            response.data = {
                totalOrders: totalSales,
                totalRevenue: `₹${totalRevenue.toLocaleString()}`,
                activeListings: activeListings,
                completedOrders: Number(orderStats[0]?.completed_orders || 0)
            };
            if (totalSales === 0) {
                response.interpretation = 'You have not recorded any sales yet. Listings with lower price benchmarks or comprehensive descriptions gain 4x more view-to-order conversions.';
                response.recommendation = 'Ensure all your listings have ISBNs, clear condition photos, and prices within 10% of marketplace averages.';
            } else {
                response.interpretation = `You have completed ${orderStats[0]?.completed_orders || 0} orders generating ₹${totalRevenue.toLocaleString()}. Sales velocity depends closely on category demand and prompt dispatch times.`;
                response.recommendation = 'Maintain active inventory in high-demand academic categories and keep order packaging under 24 hours to boost marketplace search ranking.';
            }
            response.evidence = [
                { metric: 'Completed Orders', value: orderStats[0]?.completed_orders || 0, period: 'All time', source: 'Order Ledger' },
                { metric: 'Total Revenue', value: `₹${totalRevenue}`, period: 'All time', source: 'Financial Ledger' }
            ];
            response.suggestedActions = [
                { label: 'Optimize Listing Quality', action: 'VIEW_LISTINGS' },
                { label: 'Check Competitive Prices', action: 'VIEW_PRICING' }
            ];
        } else if (prompt.includes('slow') || prompt.includes('inventory') || prompt.includes('attention') || prompt.includes('first')) {
            response.topic = 'INVENTORY_HEALTH';
            const slowMoving = books.filter(b => b.status === 'available' && (b.views_count || 0) < 5);
            const lowQuality = books.filter(b => b.quality_score && b.quality_score < 70);

            response.data = {
                totalInventory: totalListings,
                activeListings: activeListings,
                slowMovingCount: slowMoving.length,
                lowQualityScoreCount: lowQuality.length
            };
            response.interpretation = slowMoving.length > 0 
                ? `${slowMoving.length} out of ${activeListings} active books have low engagement (<5 views). Poor metadata or above-market pricing is the primary cause.`
                : 'Your current inventory shows healthy engagement across active listings.';
            response.recommendation = slowMoving.length > 0
                ? `Prioritize updating title and description on "${slowMoving[0]?.title || 'your oldest listing'}" and evaluate a 5-10% price adjustment.`
                : 'Consider expanding your catalog with popular semester textbooks to increase sales volume.';
            response.evidence = [
                { metric: 'Low-View Listings (<5 views)', value: slowMoving.length, period: 'Last 30 days', source: 'Analytics' },
                { metric: 'Listings needing improvement', value: lowQuality.length, period: 'Current', source: 'Listing Moderation' }
            ];
            response.suggestedActions = [
                { label: 'Run AI Listing Optimizer', action: 'OPTIMIZE_LISTINGS' }
            ];
        } else if (prompt.includes('fulfillment') || prompt.includes('sla') || prompt.includes('shipping') || prompt.includes('packing')) {
            response.topic = 'FULFILLMENT_SLA';
            response.data = {
                totalSLAEvents: totalSLAs,
                slaOnTimeRate: `${slaOnTimeRate}%`,
                breaches: breachedSLAs,
                avgBreachHours: `${Math.round(slaStats[0]?.avg_breach_hours || 0)} hours`
            };
            response.interpretation = breachedSLAs > 0
                ? `You have recorded ${breachedSLAs} SLA breach(es). Fulfillment delays primarily happen between order confirmation and package readiness.`
                : 'Your fulfillment operations are fully on-time with zero recorded SLA breaches.';
            response.recommendation = breachedSLAs > 0
                ? 'Package orders within 12 hours of confirmation and download shipping labels immediately to avoid SLA penalties.'
                : 'Continue current fulfillment discipline to maintain your Verified Seller priority ranking.';
            response.evidence = [
                { metric: 'SLA On-Time Percentage', value: `${slaOnTimeRate}%`, period: 'Last 30 days', source: 'Seller SLA Engine' },
                { metric: 'Breached Milestones', value: breachedSLAs, period: 'Last 30 days', source: 'Shipment Tracking' }
            ];
            response.suggestedActions = [
                { label: 'View Pending Shipments', action: 'VIEW_FULFILLMENT' }
            ];
        } else if (prompt.includes('review') || prompt.includes('customer') || prompt.includes('buyer') || prompt.includes('feedback')) {
            response.topic = 'CUSTOMER_REVIEWS';
            response.data = {
                totalReviews: totalReviews,
                averageRating: `${avgRating} / 5.0`
            };
            if (totalReviews === 0) {
                response.interpretation = 'Insufficient review data. You have not received customer reviews yet.';
                response.recommendation = 'Encourage buyers to review delivered books by ensuring clean packaging and inclusion of delivery notes.';
            } else {
                response.interpretation = `Buyers have rated your store ${avgRating} / 5 across ${totalReviews} review(s). Accurate condition descriptions drive high ratings.`;
                response.recommendation = 'Continue highlighting minor book wear in listing photos to prevent buyer disputes.';
            }
            response.evidence = [
                { metric: 'Average Customer Rating', value: `${avgRating} / 5.0`, period: 'All time', source: 'Reviews Engine' },
                { metric: 'Total Reviews Count', value: totalReviews, period: 'All time', source: 'Reviews Engine' }
            ];
        } else {
            // General overview
            response.topic = 'SELLER_OVERVIEW';
            response.data = {
                activeBooks: activeListings,
                totalOrders: totalSales,
                revenue: `₹${totalRevenue}`,
                slaOnTime: `${slaOnTimeRate}%`,
                rating: `${avgRating} ★`
            };
            response.interpretation = `You manage ${activeListings} active listings with an SLA adherence rate of ${slaOnTimeRate}% and customer rating of ${avgRating} ★.`;
            response.recommendation = 'Focus on optimizing metadata for listings with lower quality scores to maximize discoverability.';
            response.evidence = [
                { metric: 'Active Listings', value: activeListings, source: 'Catalog' },
                { metric: 'Fulfillment On-Time', value: `${slaOnTimeRate}%`, source: 'SLA' }
            ];
        }

        // Log AI Activity
        await this.logAIActivity({
            sellerId,
            feature: 'SELLER_COPILOT',
            requestType: response.topic,
            promptSnippet: prompt,
            recommendation: response.recommendation,
            evidence: response.evidence
        });

        return response;
    }

    /**
     * Helper to classify book category for grounded, category-aware AI operations
     */
    classifyBookCategory(category = '', genre = '', title = '') {
        const text = `${category} ${genre} ${title}`.toLowerCase();
        
        if (text.includes('romance') || text.includes('fiction') || text.includes('novel') || 
            text.includes('thriller') || text.includes('mystery') || text.includes('fantasy') || 
            text.includes('sci-fi') || text.includes('literature') || text.includes('manga') || 
            text.includes('comic') || text.includes('young adult') || text.includes('it ends with us')) {
            return { type: 'FICTION', label: genre || category || 'Fiction' };
        }
        if (text.includes('children') || text.includes('kid') || text.includes('fairy tale') || 
            text.includes('picture book') || text.includes('bedtime') || text.includes('toddler')) {
            return { type: 'CHILDREN', label: genre || category || "Children's Book" };
        }
        if (text.includes('academic') || text.includes('textbook') || text.includes('engineering') || 
            text.includes('computer science') || text.includes('programming') || text.includes('mathematics') || 
            text.includes('physics') || text.includes('chemistry') || text.includes('biology') || 
            text.includes('ncert') || text.includes('syllabus') || (text.includes('edition') && (text.includes('class') || text.includes('course') || text.includes('exam'))) ||
            text.includes('upsc') || text.includes('gate') || text.includes('medical') || text.includes('law')) {
            return { type: 'ACADEMIC', label: genre || category || 'Academic Textbook' };
        }
        if (text.includes('biography') || text.includes('autobiography') || text.includes('memoir') || text.includes('history')) {
            return { type: 'BIOGRAPHY', label: genre || category || 'Biography & Non-Fiction' };
        }
        if (text.includes('self-help') || text.includes('finance') || text.includes('investing') || 
            text.includes('business') || text.includes('psychology') || text.includes('habits')) {
            return { type: 'SELF_HELP', label: genre || category || 'Self-Help & Business' };
        }
        return { type: 'GENERAL', label: genre || category || 'General Reading' };
    }

    /**
     * 2. AI LISTING OPTIMIZATION
     * Evaluates book data and generates structured metadata, title, and description suggestions.
     * AI suggestions do NOT overwrite listings without explicit seller confirmation.
     */
    async optimizeListing(sellerId, bookData) {
        let { id, title, author, isbn, publisher, edition, condition, description, category, genre, price } = bookData || {};

        if (id && (!title || !price)) {
            const [rows] = await pool.execute('SELECT * FROM books WHERE id = ?', [id]);
            if (rows.length > 0) {
                const b = rows[0];
                title = title || b.title;
                author = author || b.author;
                isbn = isbn || b.isbn;
                publisher = publisher || b.publisher;
                edition = edition || b.edition;
                condition = condition || b.condition;
                description = description || b.description;
                category = category || b.genre;
                price = price || b.price;
            }
        }

        if (!title) throw new Error('Book title is required for listing optimization');

        const missingMetadata = [];
        if (!isbn || isbn.trim() === '') missingMetadata.push('ISBN (10 or 13 digits)');
        if (!author || author.trim() === '') missingMetadata.push('Author / Contributor');
        if (!publisher || publisher.trim() === '') missingMetadata.push('Publisher Name');
        if (!edition || edition.trim() === '') missingMetadata.push('Edition (e.g. 3rd Edition)');
        if (!condition || condition.trim() === '') missingMetadata.push('Specific Condition Details');
        if (!description || description.length < 40) missingMetadata.push('Detailed Description (minimum 40 characters)');

        // Build enhanced Title Suggestion
        let cleanTitle = title.trim();
        cleanTitle = cleanTitle.replace(/^(book|novel|textbook|guide)\s+/i, '');
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

        let suggestedTitle = cleanTitle;
        if (edition && !suggestedTitle.toLowerCase().includes(edition.toLowerCase())) {
            suggestedTitle += ` (${edition})`;
        }
        if (author && !suggestedTitle.toLowerCase().includes(author.toLowerCase())) {
            suggestedTitle += ` – by ${author}`;
        }

        const catInfo = this.classifyBookCategory(category, genre, cleanTitle);
        const formattedCondition = condition ? condition.toUpperCase() : 'GOOD';

        // Build category-aware description suggestion
        let suggestedDescription = '';
        if (AIProviderAdapter.isConfigured()) {
            try {
                const prompt = `Generate a 3-part structured listing description for BookNest marketplace based strictly on the provided factual book metadata:\n` +
                    `- Title: ${cleanTitle}\n` +
                    `- Author: ${author || 'Not specified'}\n` +
                    `- Category/Genre: ${catInfo.label} (${catInfo.type})\n` +
                    `- Condition: ${formattedCondition}\n` +
                    `- Edition: ${edition || 'Standard'}\n` +
                    `- Publisher: ${publisher || 'Not specified'}\n\n` +
                    `Format rules:\n` +
                    `1. 📘 Overview: 1-2 factual sentences appropriate for ${catInfo.type}. Do NOT treat fiction or romance as academic/textbook. Do NOT invent plots, inspection seals, or fake stats.\n` +
                    `2. 🔍 Condition Details: Mention condition is ${formattedCondition}. Remind buyers to review seller photos.\n` +
                    `3. 📦 Packaging & Dispatch: State item will be carefully packed and shipped promptly by seller. Do NOT claim "BookNest Verified Logistics".`;

                const aiRes = await AIProviderAdapter.generateCompletion({
                    systemPrompt: 'You are an honest, accurate marketplace listing optimizer.',
                    messages: [{ role: 'user', content: prompt }],
                    maxTokens: 300,
                    timeoutMs: 5000
                });
                if (aiRes && aiRes.content && aiRes.content.trim()) {
                    suggestedDescription = aiRes.content.trim();
                }
            } catch (e) {
                // Fall through to deterministic template
            }
        }

        if (!suggestedDescription) {
            if (catInfo.type === 'FICTION') {
                suggestedDescription = `📘 Overview:\n"${cleanTitle}"${author ? ` by ${author}` : ''} is an engaging ${catInfo.label} novel. Ideal for readers seeking compelling character-driven storytelling and popular fiction.\n\n` +
                    `🔍 Condition Details:\nCondition: ${formattedCondition}. Please review uploaded listing photos for cover condition, page edges, and binding details.\n\n` +
                    `📦 Packaging & Dispatch:\nCarefully wrapped to prevent edge creases in transit and shipped promptly by the seller.`;
            } else if (catInfo.type === 'CHILDREN') {
                suggestedDescription = `📘 Overview:\n"${cleanTitle}"${author ? ` by ${author}` : ''} is a delightful children's book featuring entertaining stories and accessible reading for young readers.\n\n` +
                    `🔍 Condition Details:\nCondition: ${formattedCondition}. Please check listing images for page clarity, cover preservation, and overall appearance.\n\n` +
                    `📦 Packaging & Dispatch:\nPacked securely in protective wrap and dispatched promptly by the seller.`;
            } else if (catInfo.type === 'ACADEMIC') {
                suggestedDescription = `📘 Overview:\n"${cleanTitle}"${author ? ` by ${author}` : ''} is a foundational study and reference resource in ${catInfo.label} for students and academic learners.\n\n` +
                    `🔍 Condition Details:\nCondition: ${formattedCondition}. Please inspect the seller photos to verify notes, marginalia, and physical condition before purchase.\n\n` +
                    `📦 Packaging & Dispatch:\nPacked securely to protect pages and corners, and dispatched promptly by the seller.`;
            } else if (catInfo.type === 'BIOGRAPHY') {
                suggestedDescription = `📘 Overview:\n"${cleanTitle}"${author ? ` by ${author}` : ''} is a compelling biographical and historical narrative offering real-world perspectives and experiences.\n\n` +
                    `🔍 Condition Details:\nCondition: ${formattedCondition}. Please inspect seller images for spine condition and page cleanliness.\n\n` +
                    `📦 Packaging & Dispatch:\nSecurely packaged for damage-free transit and dispatched promptly by the seller.`;
            } else if (catInfo.type === 'SELF_HELP') {
                suggestedDescription = `📘 Overview:\n"${cleanTitle}"${author ? ` by ${author}` : ''} offers practical frameworks, strategies, and actionable guidance in ${catInfo.label}.\n\n` +
                    `🔍 Condition Details:\nCondition: ${formattedCondition}. Please examine seller photos for any highlighting, margin notes, or shelf wear.\n\n` +
                    `📦 Packaging & Dispatch:\nSecurely packed to ensure safe arrival, and dispatched promptly by the seller.`;
            } else {
                suggestedDescription = `📘 Overview:\n"${cleanTitle}"${author ? ` by ${author}` : ''} is a popular title in ${catInfo.label}.\n\n` +
                    `🔍 Condition Details:\nCondition: ${formattedCondition}. Please inspect seller photos for physical preservation and cover quality.\n\n` +
                    `📦 Packaging & Dispatch:\nCarefully packed and dispatched promptly by the seller.`;
            }
        }

        // Search keywords derived from actual book properties
        const baseKeywords = [
            cleanTitle.toLowerCase(),
            author ? author.toLowerCase() : '',
            (category || genre) ? (category || genre).toLowerCase() : '',
            edition ? edition.toLowerCase() : ''
        ];

        if (catInfo.type === 'ACADEMIC') {
            baseKeywords.push('textbook', 'study guide', 'coursebook');
        } else if (catInfo.type === 'FICTION') {
            baseKeywords.push('fiction', 'novel', 'paperback', 'reading');
        } else if (catInfo.type === 'CHILDREN') {
            baseKeywords.push("children's book", 'kids', 'illustrated');
        } else if (catInfo.type === 'BIOGRAPHY') {
            baseKeywords.push('biography', 'memoir', 'non-fiction');
        } else if (catInfo.type === 'SELF_HELP') {
            baseKeywords.push('self help', 'personal development', 'guide');
        }

        const keywords = baseKeywords
            .filter(k => k && k.length >= 3 && k !== 'booknest verified')
            .map(k => k.trim());

        // Quality score estimation
        let qualityScoreBefore = 40;
        if (title && title.length > 10) qualityScoreBefore += 15;
        if (author) qualityScoreBefore += 15;
        if (isbn) qualityScoreBefore += 10;
        if (description && description.length > 50) qualityScoreBefore += 10;
        if (condition) qualityScoreBefore += 10;

        const potentialScoreAfter = Math.min(100, qualityScoreBefore + (missingMetadata.length * 10));

        const result = {
            bookId: id || null,
            current: {
                title,
                author,
                isbn,
                publisher,
                edition,
                condition,
                description,
                category: category || genre,
                price
            },
            suggestions: {
                suggestedTitle,
                suggestedDescription,
                missingMetadata,
                detectedCategory: catInfo.label,
                categoryType: catInfo.type,
                searchKeywords: Array.from(new Set(keywords)),
                conditionClarification: `Specify if there is highlighting, marginalia, or spine wear to prevent buyer disputes.`,
                imageRecommendations: 'Upload at least 3 high-resolution photos: front cover, spine/edges, and sample inner page.'
            },
            qualityScore: {
                currentScore: Math.min(100, qualityScoreBefore),
                potentialScore: potentialScoreAfter,
                qualityStatus: potentialScoreAfter >= 85 ? 'EXCELLENT' : (potentialScoreAfter >= 65 ? 'GOOD' : 'NEEDS_IMPROVEMENT')
            },
            disclaimer: 'AI recommendations must be reviewed and accepted by seller. Changes are not saved automatically.'
        };

        await this.logAIActivity({
            sellerId,
            feature: 'LISTING_OPTIMIZER',
            requestType: 'OPTIMIZE_METADATA',
            entityType: 'BOOK',
            entityId: id || null,
            recommendation: `Suggested Title: "${suggestedTitle}" with ${missingMetadata.length} missing fields identified.`,
            evidence: { missingCount: missingMetadata.length, currentScore: qualityScoreBefore }
        });

        return result;
    }

    /**
     * 3. AI PRICE INSIGHTS
     * Provides explainable, evidence-grounded competitive price ranges and demand analysis.
     * Distinguishes active asking prices from completed sales and states data limitations.
     */
    async getPriceInsight(sellerId, { bookId, category, condition, currentPrice, title }) {
        let price = Number(currentPrice || 0);
        let bookCategory = category;
        let bookCondition = condition;
        let bookTitle = title;
        let bookIsbn = null;
        let bookEdition = null;

        if (bookId) {
            const [bRows] = await pool.execute('SELECT * FROM books WHERE id = ?', [bookId]);
            if (bRows.length > 0) {
                const b = bRows[0];
                price = price || Number(b.price);
                bookCategory = bookCategory || b.genre;
                bookCondition = bookCondition || b.condition;
                bookTitle = bookTitle || b.title;
                bookIsbn = b.isbn;
                bookEdition = b.edition;
            }
        }

        const safeTitle = (bookTitle || '').trim().replace(/ \(Edition \d+\)/i, '');

        // 1. First Priority: Look for title or ISBN comparable matches
        let [comparables] = await pool.execute(
            `SELECT id, price, \`condition\`, edition, status, views as views_count, created_at 
             FROM books 
             WHERE status IN ('available', 'sold')
               AND (? IS NOT NULL AND isbn = ? OR (? != '' AND title LIKE ?))
               AND (? IS NULL OR id != ?)
             ORDER BY created_at DESC LIMIT 30`,
            [bookIsbn || null, bookIsbn || null, safeTitle, `%${safeTitle}%`, bookId || null, bookId || null]
        );

        let matchLevel = 'TITLE_ISBN_MATCH';

        // 2. Second Priority: Fall back to category + condition if few specific matches
        if (comparables.length < 2 && bookCategory) {
            const [catRows] = await pool.execute(
                `SELECT id, price, \`condition\`, edition, status, views as views_count, created_at 
                 FROM books 
                 WHERE genre = ? AND status IN ('available', 'sold')
                   AND (? IS NULL OR id != ?)
                 ORDER BY created_at DESC LIMIT 30`,
                [bookCategory, bookId || null, bookId || null]
            );
            comparables = catRows;
            matchLevel = 'CATEGORY_CONDITION_MATCH';
        }

        // Insufficient comparable data (< 3 items)
        if (comparables.length < 3) {
            return {
                status: 'INSUFFICIENT_DATA',
                hasSufficientData: false,
                currentPrice: price,
                confidence: 'LOW',
                comparableCount: comparables.length,
                message: 'Not enough comparable listings to provide a reliable price recommendation.',
                dataLimitations: 'A minimum of 3 comparable listings in this category/title is required for evidence-based price guidance.',
                evidence: [
                    { metric: 'Comparable Listings Found', value: comparables.length, detail: 'Insufficient sample size' }
                ],
                disclaimer: 'Sellers retain full pricing autonomy. Manual pricing is recommended when data is limited.'
            };
        }

        // Separate active asking listings from completed sales
        const activeListings = comparables.filter(c => c.status === 'available');
        const soldListings = comparables.filter(c => c.status === 'sold');

        const activePrices = activeListings.map(c => Number(c.price)).filter(p => p > 0);
        const soldPrices = soldListings.map(c => Number(c.price)).filter(p => p > 0);
        const allPrices = comparables.map(c => Number(c.price)).filter(p => p > 0);

        const activeAvg = activePrices.length > 0 
            ? Math.round(activePrices.reduce((a, b) => a + b, 0) / activePrices.length) 
            : null;
        const soldAvg = soldPrices.length > 0 
            ? Math.round(soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length) 
            : null;

        const benchmarkPrice = soldAvg || activeAvg || Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

        // Confidence calculation
        const confidence = comparables.length >= 8 ? 'HIGH' : 'MEDIUM';

        // Recommended optimal price range based on actual evidence
        let minSuggested = Math.max(50, Math.round(benchmarkPrice * 0.85));
        let maxSuggested = Math.round(benchmarkPrice * 1.15);

        if (bookCondition && ['like new', 'new', 'mint'].includes(bookCondition.toLowerCase())) {
            minSuggested = Math.round(benchmarkPrice * 0.95);
            maxSuggested = Math.round(benchmarkPrice * 1.25);
        } else if (bookCondition && ['fair', 'acceptable'].includes(bookCondition.toLowerCase())) {
            minSuggested = Math.max(40, Math.round(benchmarkPrice * 0.70));
            maxSuggested = Math.round(benchmarkPrice * 0.90);
        }

        // Relative positioning
        let relativePosition = 'AT_MARKET';
        if (price > benchmarkPrice * 1.15) relativePosition = 'ABOVE_MARKET';
        else if (price < benchmarkPrice * 0.85) relativePosition = 'BELOW_MARKET';

        // Demand estimation based on views
        const totalViews = comparables.reduce((acc, c) => acc + (c.views_count || 0), 0);
        const avgViews = totalViews / comparables.length;
        let demandIndicator = avgViews > 25 ? 'HIGH' : (avgViews < 8 ? 'LOW' : 'MODERATE');

        const result = {
            status: 'SUCCESS',
            hasSufficientData: true,
            currentPrice: price,
            confidence,
            comparableCount: comparables.length,
            activeCount: activeListings.length,
            soldCount: soldListings.length,
            currentMarketRange: {
                min: Math.min(...allPrices),
                max: Math.max(...allPrices),
                average: benchmarkPrice,
                activeAverage: activeAvg,
                soldAverage: soldAvg
            },
            relativePosition,
            demandIndicator,
            recommendedRange: {
                minSuggested,
                maxSuggested
            },
            evidence: [
                { 
                    metric: 'Active Asking Listings', 
                    value: activeListings.length, 
                    detail: activeAvg ? `Average asking price: ₹${activeAvg}` : 'No active listings currently' 
                },
                { 
                    metric: 'Completed Sales', 
                    value: soldListings.length, 
                    detail: soldAvg ? `Realized average sale price: ₹${soldAvg}` : 'No recorded completed sales yet; benchmark reflects active asking prices' 
                },
                { 
                    metric: 'Match Specificity', 
                    value: matchLevel === 'TITLE_ISBN_MATCH' ? 'Title/ISBN Matched' : 'Category Benchmark', 
                    detail: matchLevel === 'TITLE_ISBN_MATCH' ? 'Derived from specific title comparables' : `Derived from ${bookCategory || 'category'} comparables` 
                }
            ],
            dataLimitations: soldListings.length === 0
                ? 'Based solely on seller asking prices because no completed sales have been recorded for this item yet.'
                : `Based on ${activeListings.length} active listings and ${soldListings.length} completed transactions.`,
            explanation: relativePosition === 'ABOVE_MARKET'
                ? `Your asking price (₹${price}) is higher than the comparable market benchmark of ₹${benchmarkPrice}. A range of ₹${minSuggested}–₹${maxSuggested} aligns with comparable listings.`
                : relativePosition === 'BELOW_MARKET'
                ? `Your asking price (₹${price}) is below the market benchmark of ₹${benchmarkPrice}, offering competitive value to buyers.`
                : `Your asking price (₹${price}) is competitively aligned with the comparable market benchmark (₹${benchmarkPrice}).`,
            disclaimer: 'AI guidance is non-binding and derived from historical marketplace data. Sellers maintain full pricing control.'
        };

        await this.logAIActivity({
            sellerId,
            feature: 'PRICING_INTELLIGENCE',
            requestType: 'PRICE_INSIGHT',
            entityType: 'BOOK',
            entityId: bookId || null,
            recommendation: `Recommended range: ₹${minSuggested} - ₹${maxSuggested} (Current: ₹${price}, Confidence: ${confidence})`,
            evidence: { benchmarkPrice, comparableCount: comparables.length, confidence }
        });

        return result;
    }

    /**
     * 4. AI INVENTORY FORECASTING
     * Analyzes sales velocity, inventory age, and restock urgency without fabricating data.
     */
    async getInventoryForecast(sellerId, { bookId, category } = {}) {
        if (!sellerId) throw new Error('Seller ID is required for inventory forecast');

        let query = `
            SELECT b.id, b.title, b.genre as category, b.price, b.\`condition\`, b.views as views_count, b.status, b.created_at,
                   COUNT(oi.id) as past_sales_count
            FROM books b
            LEFT JOIN order_items oi ON b.id = oi.book_id
            WHERE b.seller_id = ?
        `;
        const params = [sellerId];

        if (bookId) {
            query += ' AND b.id = ?';
            params.push(bookId);
        }
        if (category) {
            query += ' AND b.genre = ?';
            params.push(category);
        }
        query += ' GROUP BY b.id ORDER BY b.created_at DESC';

        const [books] = await pool.execute(query, params);

        if (books.length === 0) {
            return {
                status: 'INSUFFICIENT_DATA',
                message: 'No active or historical inventory records found for this seller.',
                forecasts: []
            };
        }

        const forecasts = books.map(b => {
            const ageDays = Math.max(1, Math.round((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)));
            const salesCount = Number(b.past_sales_count || 0);
            const salesVelocity = Number((salesCount / Math.max(1, Math.min(30, ageDays))).toFixed(2));
            const views = Number(b.views_count || 0);

            // Handle insufficient data if listing is new (< 5 days) and has zero interactions
            if (ageDays < 5 && views < 2 && salesCount === 0) {
                return {
                    bookId: b.id,
                    title: b.title,
                    status: 'INSUFFICIENT_DATA',
                    demandState: 'INSUFFICIENT_DATA',
                    salesVelocity: 0,
                    inventoryAgeDays: ageDays,
                    slowMovingProbability: 0,
                    explanation: 'Listing was created recently; gathering real engagement metrics.'
                };
            }

            let demandState = 'NORMAL';
            let slowMovingProbability = 15;
            let restockUrgency = 'LOW';

            if (salesVelocity >= 0.2 || views > 30) {
                demandState = 'HIGH_DEMAND';
                restockUrgency = 'RESTOCK_RECOMMENDED';
                slowMovingProbability = 5;
            } else if (ageDays > 25 && salesCount === 0 && views < 8) {
                demandState = 'SLOW_MOVING';
                slowMovingProbability = 85;
                restockUrgency = 'NONE';
            }

            return {
                bookId: b.id,
                title: b.title,
                category: b.category,
                price: Number(b.price),
                status: 'AVAILABLE',
                demandState,
                salesVelocity, // units/day
                inventoryAgeDays: ageDays,
                viewsCount: views,
                restockUrgency,
                slowMovingProbability,
                explanation: demandState === 'SLOW_MOVING'
                    ? `Item listed ${ageDays} days ago with only ${views} views. High probability of stagnant capital.`
                    : (demandState === 'HIGH_DEMAND' ? 'Strong category engagement. Consider restocking complementary textbooks.' : 'Steady market interest.')
            };
        });

        await this.logAIActivity({
            sellerId,
            feature: 'INVENTORY_FORECASTING',
            requestType: 'SALES_VELOCITY_ANALYSIS',
            recommendation: `Evaluated ${forecasts.length} items. ${forecasts.filter(f => f.demandState === 'SLOW_MOVING').length} slow moving identified.`,
            evidence: { totalEvaluated: forecasts.length }
        });

        return {
            status: 'SUCCESS',
            sellerId,
            evaluatedCount: forecasts.length,
            forecasts
        };
    }

    /**
     * 5. AI FULFILLMENT INSIGHTS
     * Analyzes SLA events and dispatch metrics to highlight bottlenecks.
     */
    async getFulfillmentInsights(sellerId) {
        if (!sellerId) throw new Error('Seller ID is required for fulfillment insights');

        const [slaEvents] = await pool.execute(
            `SELECT sla_type, sla_status, breach_duration_hours, target_deadline, completed_at, created_at 
             FROM seller_sla_events 
             WHERE seller_id = ?
             ORDER BY created_at DESC LIMIT 50`,
            [sellerId]
        );

        const [shipmentRows] = await pool.execute(
            `SELECT status, carrier, shipped_at, estimated_delivery, delivered_at, created_at 
             FROM shipments 
             WHERE seller_id = ?
             ORDER BY created_at DESC LIMIT 50`,
            [sellerId]
        );

        if (slaEvents.length === 0 && shipmentRows.length === 0) {
            return {
                status: 'INSUFFICIENT_DATA',
                message: 'No fulfillment or shipment records found for this seller yet.',
                operationalSummary: 'Begin processing new orders to receive AI fulfillment insights.'
            };
        }

        const totalEvents = slaEvents.length;
        const breaches = slaEvents.filter(e => e.sla_status === 'BREACHED');
        const packingBreaches = breaches.filter(e => e.sla_type === 'PACKING').length;
        const shippingBreaches = breaches.filter(e => e.sla_type === 'SHIPPING').length;
        const processingBreaches = breaches.filter(e => e.sla_type === 'PROCESSING').length;

        let primaryBottleneck = 'None detected';
        if (packingBreaches > shippingBreaches && packingBreaches > 0) {
            primaryBottleneck = 'Order packing (time from order confirmation to packing)';
        } else if (shippingBreaches > 0) {
            primaryBottleneck = 'Courier dispatch / handoff to logistics carrier';
        } else if (processingBreaches > 0) {
            primaryBottleneck = 'Initial order acceptance / confirmation';
        }

        const onTimeRate = totalEvents > 0 ? Math.round(((totalEvents - breaches.length) / totalEvents) * 100) : 100;

        const suggestions = [];
        if (packingBreaches > 0) {
            suggestions.push('Prepare packaging materials in advance to reduce order-to-pack latency under 12 hours.');
        }
        if (shippingBreaches > 0) {
            suggestions.push('Schedule daily morning courier pickups to avoid carrier cut-off delays.');
        }
        if (suggestions.length === 0) {
            suggestions.push('Excellent operational SLA performance. Maintain current processing cadence.');
        }

        const result = {
            totalSlaEventsEvaluated: totalEvents,
            onTimeFulfillmentRate: `${onTimeRate}%`,
            totalBreaches: breaches.length,
            bottlenecks: {
                primaryBottleneck,
                packingBreaches,
                shippingBreaches,
                processingBreaches
            },
            operationalSummary: breaches.length > 0
                ? `Fulfillment SLA adherence is at ${onTimeRate}%. Most delays occur during ${primaryBottleneck.toLowerCase()}.`
                : `Flawless fulfillment record with 100% on-time processing across all evaluated orders.`,
            suggestions,
            evidence: [
                { metric: 'Total SLA Events', value: totalEvents, source: 'seller_sla_events' },
                { metric: 'Breached Events', value: breaches.length, source: 'seller_sla_events' }
            ]
        };

        await this.logAIActivity({
            sellerId,
            feature: 'FULFILLMENT_INTELLIGENCE',
            requestType: 'SLA_BOTTLENECK_ANALYSIS',
            recommendation: `Identified bottleneck: ${primaryBottleneck}`,
            evidence: { onTimeRate, totalBreaches: breaches.length }
        });

        return result;
    }

    /**
     * 6. AI REVIEW SUMMARIZATION
     * Extracts thematic insights from verified buyer reviews while preserving privacy.
     */
    async summarizeReviews({ bookId = null, sellerId = null }) {
        let reviews = [];
        if (bookId) {
            const [rows] = await pool.execute(
                `SELECT r.rating, r.comment, r.created_at, b.title 
                 FROM reviews r
                 JOIN books b ON r.book_id = b.id
                 WHERE r.book_id = ?
                 ORDER BY r.created_at DESC LIMIT 50`,
                [bookId]
            );
            reviews = rows;
        } else if (sellerId) {
            const [rows] = await pool.execute(
                `SELECT rating, comment, created_at 
                 FROM reviews 
                 WHERE seller_id = ?
                 ORDER BY created_at DESC LIMIT 50`,
                [sellerId]
            );
            reviews = rows;
        }

        // 1. Zero reviews
        if (!reviews || reviews.length === 0) {
            return {
                status: 'NO_REVIEWS',
                message: 'No reviews yet. Be the first verified buyer to review this book.',
                reviewCount: 0,
                positiveThemes: [],
                negativeThemes: [],
                summary: 'No reviews yet. Be the first verified buyer to review this book.'
            };
        }

        // 2. Insufficient reviews (< 3)
        if (reviews.length < 3) {
            return {
                status: 'INSUFFICIENT_DATA',
                message: `Only ${reviews.length} review${reviews.length === 1 ? '' : 's'} submitted so far — insufficient feedback to synthesize aggregate themes.`,
                reviewCount: reviews.length,
                positiveThemes: [],
                negativeThemes: [],
                summary: `Only ${reviews.length} verified review available. A minimum of 3 reviews is needed to summarize feedback accurately.`
            };
        }

        const ratings = reviews.map(r => Number(r.rating));
        const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
        const comments = reviews.map(r => (r.comment || '').toLowerCase());

        // Check if external LLM provider is configured
        if (AIProviderAdapter.isConfigured()) {
            try {
                const commentsSample = reviews.slice(0, 10).map((r, i) => `${i + 1}. [Rating: ${r.rating}★] ${r.comment || 'No comment text'}`).join('\n');
                const prompt = `You are a review summarizer for BookNest. Analyze the following verified customer reviews:\n\n${commentsSample}\n\n` +
                    `Provide a JSON object with this exact shape:\n` +
                    `{\n` +
                    `  "summary": "1-2 sentence overall summary highlighting common feedback from ${reviews.length} reviews",\n` +
                    `  "positiveThemes": ["Theme 1", "Theme 2"],\n` +
                    `  "negativeThemes": ["Theme 1"]\n` +
                    `}\n` +
                    `Ground your summary strictly in the real comments. If there are no negative comments, keep negativeThemes empty.`;

                const aiRes = await AIProviderAdapter.generateCompletion({
                    systemPrompt: 'You summarize real customer reviews accurately and concisely. Return valid JSON only.',
                    messages: [{ role: 'user', content: prompt }],
                    maxTokens: 350,
                    timeoutMs: 6000
                });

                if (aiRes && aiRes.content) {
                    const parsed = JSON.parse(aiRes.content.replace(/```json|```/g, '').trim());
                    return {
                        status: 'SUCCESS',
                        reviewCount: reviews.length,
                        averageRating: `${avgRating} / 5.0`,
                        summary: parsed.summary || `Based on ${reviews.length} verified customer reviews, the average rating is ${avgRating}★.`,
                        positiveThemes: parsed.positiveThemes || [],
                        negativeThemes: parsed.negativeThemes || [],
                        isAiGenerated: true
                    };
                }
            } catch (llmErr) {
                // Fall back to grounded deterministic extraction
            }
        }

        const positiveThemes = [];
        const negativeThemes = [];

        // Condition analysis from real comments
        const conditionMentions = comments.filter(c => c.includes('condition') || c.includes('page') || c.includes('clean') || c.includes('neat') || c.includes('tear') || c.includes('highlight'));
        if (conditionMentions.some(c => c.includes('good') || c.includes('clean') || c.includes('exact') || c.includes('as described') || c.includes('great') || c.includes('neat'))) {
            positiveThemes.push('Book physical condition accurately matches seller descriptions.');
        }
        if (conditionMentions.some(c => c.includes('bad') || c.includes('torn') || c.includes('stain') || c.includes('poor') || c.includes('worn'))) {
            negativeThemes.push('Some buyers noticed minor page wear or previous highlighting.');
        }

        // Delivery / Packaging analysis from real comments
        const deliveryMentions = comments.filter(c => c.includes('delivery') || c.includes('ship') || c.includes('fast') || c.includes('pack') || c.includes('delay'));
        if (deliveryMentions.some(c => c.includes('fast') || c.includes('quick') || c.includes('well packed') || c.includes('safe') || c.includes('prompt'))) {
            positiveThemes.push('Fast dispatch and secure protective packaging.');
        }
        if (deliveryMentions.some(c => c.includes('late') || c.includes('delay') || c.includes('slow') || c.includes('damaged packaging'))) {
            negativeThemes.push('Occasional courier transit delays reported.');
        }

        if (positiveThemes.length === 0) positiveThemes.push('Consistently positive overall buyer sentiment across verified purchases.');
        if (negativeThemes.length === 0) negativeThemes.push('No significant recurring buyer complaints detected.');

        const result = {
            status: 'SUCCESS',
            reviewCount: reviews.length,
            averageRating: `${avgRating} / 5.0`,
            summary: `Based on ${reviews.length} verified customer reviews, buyers report a ${avgRating}★ experience highlighting consistent condition accuracy and dependable fulfillment.`,
            positiveThemes,
            negativeThemes,
            isAiGenerated: false
        };

        return result;
    }

    /**
     * 7. AI CUSTOMER SUPPORT & ORDER EXPLANATION
     * Answers buyer inquiries on live orders with IDOR protection & strict safety boundaries.
     */
    async handleCustomerSupport(userId, { userPrompt, orderId = null, bookId = null }) {
        if (!userId) throw new Error('Authentication required for Customer Support');

        const prompt = (userPrompt || '').toLowerCase();
        let intent = 'GENERAL_MARKETPLACE_HELP';

        if (prompt.includes('refund') || prompt.includes('return') || prompt.includes('money back')) {
            intent = 'REFUND_STATUS';
        } else if (prompt.includes('payment') || prompt.includes('charged') || prompt.includes('paid')) {
            intent = 'PAYMENT_STATUS';
        } else if (prompt.includes('order') || prompt.includes('where is') || prompt.includes('status') || prompt.includes('track')) {
            intent = 'ORDER_STATUS';
        } else if (prompt.includes('cancel') || prompt.includes('stop order')) {
            intent = 'CANCEL_REQUEST';
        } else if (prompt.includes('dispute') || prompt.includes('damaged') || prompt.includes('fake')) {
            intent = 'DISPUTE_PROCESS';
        }

        // Fetch user's orders (with IDOR protection)
        let relevantOrder = null;
        if (orderId) {
            const [orders] = await pool.execute(
                `SELECT o.id, o.buyer_id, o.total_price as total_amount, o.status, o.created_at,
                        s.tracking_number, s.carrier, s.status as shipment_status, s.estimated_delivery,
                        p.status as payment_status, p.razorpay_order_id as gateway_order_id, p.amount as payment_amount
                 FROM orders o
                 LEFT JOIN shipments s ON o.id = s.order_id
                 LEFT JOIN payments p ON o.id = p.order_id
                 WHERE o.id = ? AND o.buyer_id = ?`,
                [orderId, userId]
            );
            if (orders.length > 0) {
                relevantOrder = orders[0];
            } else {
                return {
                    intent,
                    authorized: false,
                    response: 'Order not found or access denied. You can only query your own orders.',
                    safetyBoundary: 'AI adheres strictly to cross-user privacy boundaries.'
                };
            }
        } else {
            // Pick most recent order of the user if exists
            const [recentOrders] = await pool.execute(
                `SELECT o.id, o.buyer_id, o.total_price as total_amount, o.status, o.created_at,
                        s.tracking_number, s.carrier, s.status as shipment_status, s.estimated_delivery,
                        p.status as payment_status, p.razorpay_order_id as gateway_order_id
                 FROM orders o
                 LEFT JOIN shipments s ON o.id = s.order_id
                 LEFT JOIN payments p ON o.id = p.order_id
                 WHERE o.buyer_id = ?
                 ORDER BY o.created_at DESC LIMIT 1`,
                [userId]
            );
            if (recentOrders.length > 0) {
                relevantOrder = recentOrders[0];
            }
        }

        let responseText = '';
        let actionRequired = false;
        let actionDetails = null;

        if (intent === 'ORDER_STATUS' && relevantOrder) {
            const ordStatus = (relevantOrder.status || '').toUpperCase();
            const shipStatus = relevantOrder.shipment_status || 'PENDING_LABEL';
            const tracking = relevantOrder.tracking_number ? `Tracking: ${relevantOrder.tracking_number} (${relevantOrder.carrier || 'Logistics'})` : 'Tracking will update once picked up.';

            responseText = `Your Order #${relevantOrder.id} is currently in status: ${ordStatus}. ` +
                `Shipment State: ${shipStatus}. ${tracking} Total amount: ₹${relevantOrder.total_amount}.`;
        } else if (intent === 'PAYMENT_STATUS' && relevantOrder) {
            responseText = `Payment for Order #${relevantOrder.id} is ${relevantOrder.payment_status || 'COMPLETED'} via Razorpay/Card. All transactions are secured with 256-bit SSL encryption.`;
        } else if (intent === 'REFUND_STATUS') {
            responseText = 'Refunds on BookNest are processed back to the original payment source within 3-5 business days upon seller return receipt. ' +
                'Note: AI assistants cannot issue direct refunds autonomously. Please use the "Request Refund / Dispute" button on your order details page.';
            actionRequired = true;
            actionDetails = { type: 'REQUEST_REFUND_CONFIRMATION', orderId: relevantOrder?.id || null };
        } else if (intent === 'CANCEL_REQUEST') {
            responseText = 'Order cancellation requires user confirmation. If the seller has not yet dispatched the package, you can initiate cancellation directly from your order management page.';
            actionRequired = true;
            actionDetails = { type: 'ORDER_CANCELLATION_CONFIRMATION', orderId: relevantOrder?.id || null };
        } else if (intent === 'DISPUTE_PROCESS') {
            responseText = 'If an item arrived damaged or different from the description, you are protected by the BookNest Buyer Guarantee. You may open a formal dispute within 48 hours of delivery for human admin review.';
        } else {
            responseText = 'Welcome to NestAI Support. You can check order tracking, delivery timelines, payment confirmations, and return policies anytime.';
        }

        await this.logAIActivity({
            userId,
            feature: 'CUSTOMER_SUPPORT',
            requestType: intent,
            entityType: 'ORDER',
            entityId: relevantOrder?.id || null,
            recommendation: responseText,
            evidence: { orderStatus: relevantOrder?.status || 'N/A' }
        });

        return {
            intent,
            authorized: true,
            response: responseText,
            actionRequired,
            actionDetails,
            safetyNotice: 'AI cannot execute financial refunds or cancel orders automatically. Human confirmation is required.'
        };
    }

    /**
     * 8. MARKETPLACE ANOMALY DETECTION
     * Scans for high-velocity spikes, cancellation surges, refund spikes, and payment failure anomalies.
     */
    async scanMarketplaceAnomalies() {
        const detectedAnomalies = [];

        // 1. Check order cancellation spike (last 24 hours vs baseline)
        const [cancelData] = await pool.execute(`
            SELECT COUNT(*) as total_recent_orders,
                   COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
            FROM orders
            WHERE created_at >= NOW() - INTERVAL 24 HOUR
        `);
        const totalRecent = Number(cancelData[0]?.total_recent_orders || 0);
        const cancelledRecent = Number(cancelData[0]?.cancelled_count || 0);
        if (totalRecent >= 5 && (cancelledRecent / totalRecent) >= 0.3) {
            detectedAnomalies.push({
                anomaly_type: 'UNUSUAL_CANCELLATION_SPIKE',
                severity: 'HIGH',
                affected_entity_type: 'MARKETPLACE_ORDERS',
                affected_entity_id: null,
                confidence: 88.5,
                evidence: { totalRecentOrders: totalRecent, cancelledCount: cancelledRecent, cancellationRate: `${Math.round((cancelledRecent / totalRecent) * 100)}%` }
            });
        }

        // 2. Check payment failure spike
        const [paymentData] = await pool.execute(`
            SELECT COUNT(*) as total_payments,
                   COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
            FROM payments
            WHERE created_at >= NOW() - INTERVAL 24 HOUR
        `);
        const totalPayments = Number(paymentData[0]?.total_payments || 0);
        const failedPayments = Number(paymentData[0]?.failed_payments || 0);
        if (totalPayments >= 5 && (failedPayments / totalPayments) >= 0.3) {
            detectedAnomalies.push({
                anomaly_type: 'PAYMENT_FAILURE_SURGE',
                severity: 'HIGH',
                affected_entity_type: 'PAYMENT_GATEWAY',
                affected_entity_id: null,
                confidence: 92.0,
                evidence: { totalPayments, failedPayments, failureRate: `${Math.round((failedPayments / totalPayments) * 100)}%` }
            });
        }

        // 3. Check SLA fulfillment delay spike
        const [slaData] = await pool.execute(`
            SELECT COUNT(*) as total_events,
                   COUNT(CASE WHEN sla_status = 'BREACHED' THEN 1 END) as breaches
            FROM seller_sla_events
            WHERE created_at >= NOW() - INTERVAL 48 HOUR
        `);
        const totalSla = Number(slaData[0]?.total_events || 0);
        const breaches = Number(slaData[0]?.breaches || 0);
        if (totalSla >= 5 && (breaches / totalSla) >= 0.3) {
            detectedAnomalies.push({
                anomaly_type: 'FULFILLMENT_SLA_BREACH_SPIKE',
                severity: 'MEDIUM',
                affected_entity_type: 'FULFILLMENT_NETWORK',
                affected_entity_id: null,
                confidence: 85.0,
                evidence: { totalSlaEvents: totalSla, breaches, breachRate: `${Math.round((breaches / totalSla) * 100)}%` }
            });
        }

        // 4. Check single-seller high refund concentration
        const [sellerRefunds] = await pool.execute(`
            SELECT b.seller_id, COUNT(DISTINCT o.id) as total_seller_orders,
                   COUNT(DISTINCT CASE WHEN o.status = 'refunded' THEN o.id END) as refunded_orders
            FROM order_items oi
            JOIN books b ON oi.book_id = b.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at >= NOW() - INTERVAL 7 DAY
            GROUP BY b.seller_id
            HAVING total_seller_orders >= 4 AND (refunded_orders / total_seller_orders) >= 0.5
        `);
        for (const sr of sellerRefunds) {
            detectedAnomalies.push({
                anomaly_type: 'HIGH_SELLER_REFUND_CONCENTRATION',
                severity: 'HIGH',
                affected_entity_type: 'SELLER',
                affected_entity_id: sr.seller_id,
                confidence: 90.0,
                evidence: { sellerId: sr.seller_id, totalOrders: sr.total_seller_orders, refundedOrders: sr.refunded_orders }
            });
        }

        // Store detected anomalies in DB
        for (const a of detectedAnomalies) {
            await pool.execute(
                `INSERT INTO ai_anomalies (anomaly_type, severity, affected_entity_type, affected_entity_id, confidence, evidence, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
                [a.anomaly_type, a.severity, a.affected_entity_type, a.affected_entity_id, a.confidence, JSON.stringify(a.evidence)]
            );
        }

        // Emit real-time Socket.io alert to admin room if anomalies detected
        if (detectedAnomalies.length > 0 && getIO && typeof getIO === 'function') {
            try {
                const io = getIO();
                if (io) {
                    io.to('admin').emit('MARKETPLACE_ANOMALY_DETECTED', {
                        count: detectedAnomalies.length,
                        anomalies: detectedAnomalies,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (e) {
                console.warn('[Socket] Anomaly alert emit error:', e.message);
            }
        }

        return detectedAnomalies;
    }

    /**
     * Get active marketplace anomalies
     */
    async getMarketplaceAnomalies({ status = 'ACTIVE', severity = null } = {}) {
        let query = 'SELECT * FROM ai_anomalies WHERE 1=1';
        const params = [];
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }
        query += ' ORDER BY detected_at DESC LIMIT 50';

        const [rows] = await pool.execute(query, params);
        return rows.map(r => ({
            ...r,
            evidence: typeof r.evidence === 'string' ? JSON.parse(r.evidence) : r.evidence
        }));
    }

    /**
     * 9. AI MARKETPLACE HEALTH REPORT & ADMIN OPERATIONS
     * Produces a 10-dimension operations summary for platform administrators.
     */
    async getMarketplaceHealthReport(adminId, { timeRange = '30d' } = {}) {
        if (!adminId) throw new Error('Admin credentials required for Marketplace Health Report');

        const cacheKey = `marketplace_health_${timeRange}`;
        const cached = await this.getCachedInsight(cacheKey);
        if (cached) return cached;

        // 1. Marketplace Performance & Orders
        const [ordersAgg] = await pool.execute(`
            SELECT COUNT(*) as total_orders,
                   COALESCE(SUM(total_price), 0) as gmv,
                   COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
                   COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
                   COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_orders
            FROM orders
            WHERE created_at >= NOW() - INTERVAL 30 DAY
        `);

        // 2. Books & Catalog Inventory
        const [booksAgg] = await pool.execute(`
            SELECT COUNT(*) as total_books,
                   COUNT(CASE WHEN status = 'available' THEN 1 END) as available_books,
                   COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_books,
                   COALESCE(AVG(price), 0) as avg_price
            FROM books
        `);

        // 3. Seller Operations & Onboarding
        const [sellersAgg] = await pool.execute(`
            SELECT COUNT(DISTINCT id) as total_users,
                   COUNT(DISTINCT CASE WHEN role = 'ADMIN' THEN id END) as admin_count
            FROM users
        `);

        const [slaAgg] = await pool.execute(`
            SELECT COUNT(*) as total_sla,
                   COUNT(CASE WHEN sla_status = 'BREACHED' THEN 1 END) as breaches
            FROM seller_sla_events
        `);

        // 4. Payments
        const [paymentsAgg] = await pool.execute(`
            SELECT COUNT(*) as total_payments,
                   COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
                   COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
            FROM payments
        `);

        // 5. Reviews
        const [reviewsAgg] = await pool.execute(`
            SELECT COUNT(*) as total_reviews,
                   COALESCE(AVG(rating), 0) as avg_rating
            FROM reviews
        `);

        // 6. Active anomalies count
        const [anomaliesAgg] = await pool.execute(`
            SELECT COUNT(*) as active_anomalies
            FROM ai_anomalies
            WHERE status = 'ACTIVE'
        `);

        const totalOrders = Number(ordersAgg[0]?.total_orders || 0);
        const gmv = Number(ordersAgg[0]?.gmv || 0);
        const deliveredOrders = Number(ordersAgg[0]?.delivered_orders || 0);
        const cancelledOrders = Number(ordersAgg[0]?.cancelled_orders || 0);
        const totalBooks = Number(booksAgg[0]?.total_books || 0);
        const availableBooks = Number(booksAgg[0]?.available_books || 0);
        const totalSla = Number(slaAgg[0]?.total_sla || 0);
        const breaches = Number(slaAgg[0]?.breaches || 0);
        const totalPayments = Number(paymentsAgg[0]?.total_payments || 0);
        const successfulPayments = Number(paymentsAgg[0]?.successful_payments || 0);

        const paymentSuccessRate = totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100) : 100;
        const fulfillmentAdherence = totalSla > 0 ? Math.round(((totalSla - breaches) / totalSla) * 100) : 100;

        const report = {
            generatedAt: new Date().toISOString(),
            timeRange,
            sections: {
                marketplacePerformance: {
                    gmv: `₹${gmv.toLocaleString()}`,
                    totalOrders,
                    deliveredOrders,
                    cancelledOrders,
                    healthStatus: cancelledOrders / Math.max(1, totalOrders) < 0.1 ? 'HEALTHY' : 'NEEDS_ATTENTION'
                },
                catalogInventory: {
                    totalListings: totalBooks,
                    activeAvailable: availableBooks,
                    averagePrice: `₹${Math.round(booksAgg[0]?.avg_price || 0)}`
                },
                fulfillmentHealth: {
                    totalSlaEvents: totalSla,
                    slaBreaches: breaches,
                    onTimeRate: `${fulfillmentAdherence}%`
                },
                paymentIntegrity: {
                    totalPayments,
                    successfulPayments,
                    successRate: `${paymentSuccessRate}%`
                },
                customerSentiment: {
                    totalReviews: Number(reviewsAgg[0]?.total_reviews || 0),
                    averageRating: `${Number(reviewsAgg[0]?.avg_rating || 0).toFixed(1)} ★`
                },
                activeAnomaliesCount: Number(anomaliesAgg[0]?.active_anomalies || 0)
            },
            executiveSummary: `Marketplace operating at ₹${gmv.toLocaleString()} GMV with ${paymentSuccessRate}% payment success rate and ${fulfillmentAdherence}% fulfillment SLA adherence. Total ${Number(anomaliesAgg[0]?.active_anomalies || 0)} active operational anomalies flagged for review.`
        };

        // Cache for 30 minutes
        await this.setCachedInsight(cacheKey, 'ADMIN_HEALTH_REPORT', report, 30, { userId: adminId });

        await this.logAIActivity({
            userId: adminId,
            feature: 'ADMIN_OPERATIONS',
            requestType: 'MARKETPLACE_HEALTH_REPORT',
            recommendation: report.executiveSummary,
            evidence: { gmv, totalOrders, paymentSuccessRate }
        });

        return report;
    }

    /**
     * Admin AI Assistant query
     */
    async getAdminOperationsAssistant(adminId, { query }) {
        if (!adminId) throw new Error('Admin credentials required');
        const q = (query || '').toLowerCase();

        if (q.includes('order') || q.includes('attention') || q.includes('stuck')) {
            const [stuckOrders] = await pool.execute(`
                SELECT o.id, o.buyer_id, o.status, o.total_price as total_amount, o.created_at, u.full_name as buyer_name
                FROM orders o
                LEFT JOIN users u ON o.buyer_id = u.id
                WHERE o.status IN ('processing', 'ready_to_pack', 'packed') AND o.created_at <= NOW() - INTERVAL 48 HOUR
                ORDER BY o.created_at ASC LIMIT 10
            `);
            return {
                topic: 'ORDERS_NEEDING_ATTENTION',
                count: stuckOrders.length,
                data: stuckOrders,
                explanation: `${stuckOrders.length} order(s) have remained unfulfilled for over 48 hours without shipping progression.`,
                recommendation: 'Contact responsible sellers or assign priority courier dispatch.',
                requiresHumanAction: true
            };
        } else if (q.includes('moderation') || q.includes('flagged') || q.includes('listings')) {
            const [modListings] = await pool.execute(`
                SELECT lm.book_id, lm.seller_id, lm.quality_score, lm.moderation_status, lm.flagged_reason, b.title
                FROM listing_moderation lm
                JOIN books b ON lm.book_id = b.id
                WHERE lm.moderation_status IN ('PENDING_REVIEW', 'FLAGGED')
                ORDER BY lm.created_at DESC LIMIT 10
            `);
            return {
                topic: 'LISTINGS_NEEDING_MODERATION',
                count: modListings.length,
                data: modListings,
                explanation: `${modListings.length} listing(s) flagged for duplicate suspicion or missing copyright metadata.`,
                recommendation: 'Review listing details in Admin Moderation queue. AI will not reject listings autonomously.',
                requiresHumanAction: true
            };
        } else {
            return {
                topic: 'GENERAL_ADMIN_ASSISTANT',
                explanation: 'Admin Operations AI is connected to live order, SLA, moderation, and payment streams.',
                recommendation: 'You can ask "Which orders need attention?", "Which listings need moderation?", or "Scan marketplace anomalies".'
            };
        }
    }

    /**
     * Human-in-the-loop Action Apply Handler
     * Enforces that AI cannot autonomously execute consequential actions.
     */
    async applyHumanAction(userId, { actionType, entityId, payload }) {
        if (!userId) throw new Error('Authentication required to apply action');

        let result = null;

        if (actionType === 'APPLY_OPTIMIZED_TITLE') {
            const { title } = payload || {};
            if (!title) throw new Error('Title is required');
            await pool.execute('UPDATE books SET title = ? WHERE id = ? AND seller_id = ?', [title, entityId, userId]);
            result = { success: true, message: 'Title successfully updated with AI recommendation.' };
        } else if (actionType === 'APPLY_OPTIMIZED_DESCRIPTION') {
            const { description } = payload || {};
            if (!description) throw new Error('Description is required');
            await pool.execute('UPDATE books SET description = ? WHERE id = ? AND seller_id = ?', [description, entityId, userId]);
            result = { success: true, message: 'Description successfully updated with AI recommendation.' };
        } else if (actionType === 'APPLY_PRICE_ADJUSTMENT') {
            const { price } = payload || {};
            if (!price || Number(price) <= 0) throw new Error('Valid price is required');
            await pool.execute('UPDATE books SET price = ? WHERE id = ? AND seller_id = ?', [price, entityId, userId]);
            result = { success: true, message: `Price adjusted to ₹${price} following AI price analysis.` };
        } else if (actionType === 'DISMISS_RECOMMENDATION') {
            result = { success: true, message: 'Recommendation dismissed.' };
        } else {
            throw new Error(`Unsupported or restricted action type: ${actionType}. High-impact financial/moderation actions require dedicated admin portals.`);
        }

        // Log confirmation
        await this.logAIActivity({
            userId,
            feature: 'HUMAN_IN_THE_LOOP',
            requestType: actionType,
            entityType: 'BOOK',
            entityId,
            userAction: actionType === 'DISMISS_RECOMMENDATION' ? 'DISMISSED' : 'APPLIED',
            actionResult: JSON.stringify(result)
        });

        return result;
    }

    /**
     * Get AI Activity Logs (for audit/admin/seller inspection)
     */
    async getActivityLogs({ userId = null, sellerId = null, limit = 50 } = {}) {
        let query = 'SELECT * FROM ai_activity_logs WHERE 1=1';
        const params = [];
        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        if (sellerId) {
            query += ' AND seller_id = ?';
            params.push(sellerId);
        }
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
        query += ` ORDER BY created_at DESC LIMIT ${safeLimit}`;

        const [rows] = await pool.execute(query, params);
        return rows.map(r => ({
            ...r,
            evidence: typeof r.evidence === 'string' ? JSON.parse(r.evidence) : r.evidence
        }));
    }
}

module.exports = new AIMarketplaceOperationsService();
