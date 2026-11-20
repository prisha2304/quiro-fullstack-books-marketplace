const express = require('express');
const router = express.Router();
const { 
    getWishlist, 
    addToWishlist, 
    removeFromWishlist,
    mergeGuestWishlist
} = require('../controllers/personalizationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getWishlist);
router.post('/merge', mergeGuestWishlist);
router.post('/:bookId', addToWishlist);
router.delete('/:bookId', removeFromWishlist);

module.exports = router;
