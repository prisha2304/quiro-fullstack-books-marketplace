const express = require('express');
const router = express.Router();
const { getCart, addToCart, removeFromCart, clearCart, updateQuantity } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getCart);
router.post('/:bookId', addToCart);
router.put('/:bookId', updateQuantity);
router.delete('/:bookId', removeFromCart);
router.delete('/', clearCart);

module.exports = router;
