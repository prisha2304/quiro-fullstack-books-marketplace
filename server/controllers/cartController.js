const Cart = require('../models/Cart');

const getCart = async (req, res) => {
    try {
        const items = await Cart.findByUserId(req.user.id);
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching cart', error: error.message });
    }
};

const addToCart = async (req, res) => {
    try {
        const added = await Cart.add(req.user.id, req.params.bookId);
        res.json({ message: added ? 'Added to cart' : 'Already in cart' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const removeFromCart = async (req, res) => {
    try {
        await Cart.remove(req.user.id, req.params.bookId);
        res.json({ message: 'Removed from cart' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing from cart', error: error.message });
    }
};

const clearCart = async (req, res) => {
    try {
        await Cart.clear(req.user.id);
        res.json({ message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing cart', error: error.message });
    }
};

const updateQuantity = async (req, res) => {
    try {
        const { quantity } = req.body;
        const bookId = req.params.bookId;
        const updated = await Cart.updateQuantity(req.user.id, bookId, parseInt(quantity));
        res.json({ message: 'Quantity updated', updated });
    } catch (error) {
        res.status(500).json({ message: 'Error updating quantity', error: error.message });
    }
};

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    clearCart,
    updateQuantity
};
