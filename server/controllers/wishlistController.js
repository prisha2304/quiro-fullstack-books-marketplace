const Wishlist = require('../models/Wishlist');

const getWishlist = async (req, res) => {
    try {
        const items = await Wishlist.findByUserId(req.user.id);
        const ids = await Wishlist.getIdsForUser(req.user.id);
        res.json({ items, ids });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching wishlist', error: error.message });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const added = await Wishlist.add(req.user.id, req.params.bookId);
        res.json({ message: added ? 'Added to wishlist' : 'Already in wishlist' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding to wishlist', error: error.message });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        await Wishlist.remove(req.user.id, req.params.bookId);
        res.json({ message: 'Removed from wishlist' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing from wishlist', error: error.message });
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};
