const PersonalizationService = require('../services/personalizationService');

/**
 * ==========================================
 * WISHLIST & MERGE
 * ==========================================
 */
const getWishlist = async (req, res) => {
    try {
        const { sort = 'date' } = req.query;
        const items = await PersonalizationService.getEnrichedWishlist(req.user.id, sort);
        const ids = items.map(i => i.bookId);
        res.json({ items, ids });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching wishlist', error: error.message });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { bookId } = req.params;
        const Wishlist = require('../models/Wishlist');
        const added = await Wishlist.add(req.user.id, bookId);
        res.json({ message: added ? 'Added to wishlist' : 'Already in wishlist', bookId });
    } catch (error) {
        res.status(500).json({ message: 'Error adding to wishlist', error: error.message });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { bookId } = req.params;
        const Wishlist = require('../models/Wishlist');
        await Wishlist.remove(req.user.id, bookId);
        res.json({ message: 'Removed from wishlist', bookId });
    } catch (error) {
        res.status(500).json({ message: 'Error removing from wishlist', error: error.message });
    }
};

const mergeGuestWishlist = async (req, res) => {
    try {
        const { bookIds } = req.body;
        const mergedCount = await PersonalizationService.mergeGuestWishlist(req.user.id, bookIds);
        res.json({ message: `Successfully merged ${mergedCount} items into your wishlist`, mergedCount });
    } catch (error) {
        res.status(500).json({ message: 'Error merging guest wishlist', error: error.message });
    }
};

/**
 * ==========================================
 * ALERTS (PRICE DROP & BACK IN STOCK)
 * ==========================================
 */
const createPriceAlert = async (req, res) => {
    try {
        const { bookId, targetPrice } = req.body;
        if (!bookId) return res.status(400).json({ message: 'Book ID is required' });

        const alert = await PersonalizationService.createPriceAlert(req.user.id, bookId, targetPrice);
        res.status(201).json({ message: 'Price drop alert activated', alert });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const removePriceAlert = async (req, res) => {
    try {
        const { bookId } = req.params;
        await PersonalizationService.removePriceAlert(req.user.id, bookId);
        res.json({ message: 'Price drop alert removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const subscribeStockAlert = async (req, res) => {
    try {
        const { bookId } = req.body;
        if (!bookId) return res.status(400).json({ message: 'Book ID is required' });

        const alert = await PersonalizationService.subscribeStockAlert(req.user.id, bookId);
        res.status(201).json({ message: 'Back in stock notification enabled', alert });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const removeStockAlert = async (req, res) => {
    try {
        const { bookId } = req.params;
        await PersonalizationService.removeStockAlert(req.user.id, bookId);
        res.json({ message: 'Stock alert removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ==========================================
 * RECENTLY VIEWED
 * ==========================================
 */
const trackRecentlyViewed = async (req, res) => {
    try {
        const { bookId } = req.params;
        const userId = req.user ? req.user.id : null;
        await PersonalizationService.trackRecentlyViewed(userId, bookId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getRecentlyViewed = async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const books = await PersonalizationService.getRecentlyViewed(req.user.id, limit);
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const clearRecentlyViewed = async (req, res) => {
    try {
        const { pool } = require('../config/db');
        await pool.query('DELETE FROM user_activity WHERE user_id = ? AND activity_type = "view"', [req.user.id]);
        res.json({ message: 'Recently viewed history cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ==========================================
 * SEARCH HISTORY
 * ==========================================
 */
const recordSearch = async (req, res) => {
    try {
        const { query } = req.body;
        if (req.user) {
            await PersonalizationService.recordSearch(req.user.id, query);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSearchHistory = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const history = await PersonalizationService.getSearchHistory(req.user.id, limit);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteSearchItem = async (req, res) => {
    try {
        const { id } = req.params;
        await PersonalizationService.deleteSearchItem(req.user.id, id);
        res.json({ message: 'Search item deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const clearSearchHistory = async (req, res) => {
    try {
        await PersonalizationService.clearSearchHistory(req.user.id);
        res.json({ message: 'Search history cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ==========================================
 * SELLER FOLLOWS & SOCIAL PROOF
 * ==========================================
 */
const followSeller = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const result = await PersonalizationService.followSeller(req.user.id, sellerId);
        res.json({ message: 'Now following seller', ...result });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const unfollowSeller = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const result = await PersonalizationService.unfollowSeller(req.user.id, sellerId);
        res.json({ message: 'Unfollowed seller', ...result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getFollowedSellers = async (req, res) => {
    try {
        const sellers = await PersonalizationService.getFollowedSellers(req.user.id);
        res.json(sellers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBookSocialProof = async (req, res) => {
    try {
        const { bookId } = req.params;
        const proof = await PersonalizationService.getBookSocialProof(bookId);
        if (!proof) return res.status(404).json({ message: 'Book not found' });
        res.json(proof);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ==========================================
 * PROFILE & ACHIEVEMENTS
 * ==========================================
 */
const getUserReadingProfile = async (req, res) => {
    try {
        const profile = await PersonalizationService.getUserReadingProfile(req.user.id);
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUserAchievements = async (req, res) => {
    try {
        const achievements = await PersonalizationService.calculateAndAwardAchievements(req.user.id);
        res.json(achievements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ==========================================
 * HOMEPAGE PERSONALIZATION
 * ==========================================
 */
const getPersonalizedHomepage = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const homepage = await PersonalizationService.getPersonalizedHomepage(userId);
        res.json(homepage);
    } catch (error) {
        res.status(500).json({ message: 'Error generating homepage personalization', error: error.message });
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    mergeGuestWishlist,
    createPriceAlert,
    removePriceAlert,
    subscribeStockAlert,
    removeStockAlert,
    trackRecentlyViewed,
    getRecentlyViewed,
    clearRecentlyViewed,
    recordSearch,
    getSearchHistory,
    deleteSearchItem,
    clearSearchHistory,
    followSeller,
    unfollowSeller,
    getFollowedSellers,
    getBookSocialProof,
    getUserReadingProfile,
    getUserAchievements,
    getPersonalizedHomepage
};
