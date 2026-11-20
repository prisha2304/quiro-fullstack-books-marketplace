const AIService = require('../services/aiService');
const AIShoppingService = require('../services/aiShoppingService');
const AIVisualSearchService = require('../services/aiVisualSearchService');
const AIInsightService = require('../services/aiInsightService');

const chat = async (req, res) => {
    try {
        const { message, sessionId, bookId, currentBookContext, context = [] } = req.body;
        const userId = req.user?.id || null;
        const effectiveSessionId = sessionId || req.headers['x-session-id'] || (userId ? null : 'guest_session');

        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        const safeContext = Array.isArray(context) ? context.slice(-10) : [];

        const result = await AIService.processUserQuery({
            userId,
            sessionId: effectiveSessionId,
            message,
            bookId,
            currentBookContext,
            context: safeContext,
            req
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'AI processing error', error: error.message });
    }
};

const visualSearch = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Image file is required (JPG, PNG, WEBP max 5MB)' });
        }

        const userId = req.user?.id || null;
        const sessionId = req.body.sessionId || req.headers['x-session-id'] || (userId ? null : 'guest_visual_session');

        const result = await AIVisualSearchService.identifyBookCover({
            imageBuffer: req.file.buffer,
            filePath: req.file.path,
            userId,
            sessionId
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Visual search error', error: error.message });
    }
};

const handleAction = async (req, res) => {
    try {
        const { action, bookId, quantity = 1, payload = {} } = req.body;
        const userId = req.user?.id || null;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required for marketplace actions', requiresAuth: true });
        }

        if (!action) {
            return res.status(400).json({ message: 'Action is required' });
        }

        const result = await AIShoppingService.executeAction(userId, action, bookId, quantity, req, payload);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Action execution error', error: error.message });
    }
};

const compare = async (req, res) => {
    try {
        const { bookIds, preferences = {} } = req.body;
        const userId = req.user?.id || null;

        if (!bookIds || !Array.isArray(bookIds) || bookIds.length < 2) {
            return res.status(400).json({ message: 'At least 2 book IDs are required for comparison' });
        }

        const result = await AIService.compareBookIds({
            bookIds,
            userId,
            preferences
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'AI comparison error', error: error.message });
    }
};

const getInsights = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required to access personalized insights' });
        }

        const insights = await AIInsightService.getUserInsights(userId);
        res.json(insights);
    } catch (error) {
        res.status(500).json({ message: 'Error generating AI insights', error: error.message });
    }
};

const getSellerInsights = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required to access seller insights' });
        }

        const sellerInsights = await AIInsightService.getSellerInsights(userId);
        res.json(sellerInsights);
    } catch (error) {
        res.status(500).json({ message: 'Error generating seller insights', error: error.message });
    }
};

const getProactiveTip = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const tip = await AIInsightService.getProactiveChatTip(userId);
        res.json(tip);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching proactive tip', error: error.message });
    }
};

const dismissAlert = async (req, res) => {
    try {
        const { alertId } = req.body;
        res.json({ success: true, message: `Alert ${alertId || ''} dismissed` });
    } catch (error) {
        res.status(500).json({ message: 'Error dismissing alert', error: error.message });
    }
};

const getHistory = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const sessionId = req.query.sessionId || req.headers['x-session-id'] || (userId ? null : 'guest_session');

        const history = await AIService.getChatHistory({ userId, sessionId });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching AI history', error: error.message });
    }
};

const clearHistory = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const sessionId = req.query.sessionId || req.headers['x-session-id'] || (userId ? null : 'guest_session');

        await AIService.clearChatHistory({ userId, sessionId });
        res.json({ message: 'AI chat history cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing AI history', error: error.message });
    }
};

module.exports = {
    chat,
    visualSearch,
    handleAction,
    compare,
    getInsights,
    getSellerInsights,
    getProactiveTip,
    dismissAlert,
    getHistory,
    clearHistory
};
