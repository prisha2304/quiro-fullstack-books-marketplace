const express = require('express');
const router = express.Router();
const { 
    getBooks, 
    getFeaturedBooks, 
    getBookById, 
    getRelatedBooks,
    getMyBooks,
    getSuggestions,
    createBook,
    updateBook,
    deleteBook
} = require('../controllers/bookController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// Protected user listing routes (registered before /:id to prevent route shadowing)
router.get('/user/my', protect, getMyBooks);
router.get('/my', protect, getMyBooks);

// Public routes
router.get('/', optionalAuth, getBooks);
router.get('/featured', getFeaturedBooks);
router.get('/suggestions', getSuggestions);
router.get('/related/:id', getRelatedBooks);
router.get('/:id', optionalAuth, getBookById);

// Protected routes (require login)
router.post('/', protect, createBook);
router.put('/:id', protect, updateBook);
router.delete('/:id', protect, deleteBook);

module.exports = router;
