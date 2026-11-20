const { pool } = require('../config/db');
const recommendationService = require('../services/recommendationService');

const getGenreRecommendations = async (req, res) => {
    try {
        const { bookId } = req.params;
        if (!bookId) {
            return res.status(400).json({ message: 'Book ID is required' });
        }

        const recommendations = await recommendationService.getGenreRecommendations(bookId, 6);
        if (!recommendations) {
            return res.status(404).json({ message: 'Book not found' });
        }

        res.json(recommendations);
    } catch (error) {
        console.error('Error fetching genre recommendations:', error);
        res.status(500).json({ message: 'Error fetching genre recommendations', error: error.message });
    }
};

const getCoPurchaseRecommendations = async (req, res) => {
    try {
        const { bookId } = req.params;
        if (!bookId) {
            return res.status(400).json({ message: 'Book ID is required' });
        }

        const recommendations = await recommendationService.getCoPurchaseRecommendations(bookId, 6);
        if (!recommendations) {
            return res.status(404).json({ message: 'Book not found' });
        }

        res.json(recommendations);
    } catch (error) {
        console.error('Error fetching co-purchase recommendations:', error);
        res.status(500).json({ message: 'Error fetching co-purchase recommendations', error: error.message });
    }
};

const getPersonalizedRecommendations = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        let guestBookIds = [];
        if (req.query.viewedBookIds) {
            guestBookIds = String(req.query.viewedBookIds)
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n) && n > 0);
        }
        const limit = parseInt(req.query.limit, 10) || 8;
        const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit, guestBookIds);
        res.json(recommendations);
    } catch (error) {
        console.error('Error fetching personalized recommendations:', error);
        res.status(500).json({ message: 'Error fetching personalized recommendations', error: error.message });
    }
};

const getUserProfileAnalytics = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const profile = await recommendationService.calculateUserAffinity(userId);
        res.json(profile);
    } catch (error) {
        console.error('Error fetching user profile analytics:', error);
        res.status(500).json({ message: 'Error fetching user profile analytics', error: error.message });
    }
};

const trackActivity = async (req, res, next) => {
    if (req.user && req.params.id) {
        try {
            await pool.execute(
                'INSERT INTO user_activity (user_id, activity_type, reference_id) VALUES (?, "view", ?)',
                [req.user.id, req.params.id]
            );
        } catch (error) {
            console.error('Activity tracking error:', error);
        }
    }
    next();
};

const getSuggestions = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const [books] = await pool.execute(
            'SELECT title, author, genre FROM books WHERE title LIKE ? OR author LIKE ? OR genre LIKE ? LIMIT 8',
            [`%${query}%`, `%${query}%`, `%${query}%`]
        );

        const suggestions = [];
        books.forEach(b => {
           if (b.title.toLowerCase().includes(query.toLowerCase())) suggestions.push({ type: 'book', text: b.title });
           if (b.author.toLowerCase().includes(query.toLowerCase())) suggestions.push({ type: 'author', text: b.author });
           if (b.genre.toLowerCase().includes(query.toLowerCase())) suggestions.push({ type: 'genre', text: b.genre });
        });

        const unique = Array.from(new Set(suggestions.map(s => JSON.stringify(s)))).map(s => JSON.parse(s)).slice(0, 5);

        res.json(unique);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching suggestions', error: error.message });
    }
};

const getRecentActivity = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT DISTINCT b.* 
            FROM user_activity ua
            JOIN books b ON ua.reference_id = b.id
            WHERE ua.user_id = ? AND ua.activity_type = 'view'
            ORDER BY ua.created_at DESC LIMIT 10
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching recent activity', error: error.message });
    }
};

const mergeGuestHistory = async (req, res) => {
    try {
        const { bookIds } = req.body;
        const count = await recommendationService.mergeGuestHistory(req.user.id, bookIds);
        res.json({ message: 'Guest history merged', count });
    } catch (error) {
        res.status(500).json({ message: 'Error merging history', error: error.message });
    }
};

module.exports = {
    getGenreRecommendations,
    getCoPurchaseRecommendations,
    getPersonalizedRecommendations,
    getUserProfileAnalytics,
    trackActivity,
    getSuggestions,
    getRecentActivity,
    mergeGuestHistory
};
