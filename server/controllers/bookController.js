const Book = require('../models/Book');
const { pool } = require('../config/db');

const getBooks = async (req, res) => {
    try {
        const searchTerm = req.query.search || req.query.query || req.query.q || '';
        
        // Log search activity if user is authenticated and query is present
        if (req.user && searchTerm.trim()) {
            try {
                await pool.execute(
                    'INSERT INTO user_activity (user_id, activity_type, search_query) VALUES (?, "search", ?)',
                    [req.user.id, searchTerm.trim()]
                );
            } catch (e) {
                // Non-blocking
            }
        }

        const filters = {
            search: searchTerm,
            genre: req.query.category || req.query.genre,
            condition: req.query.condition,
            language: req.query.language,
            priceMin: req.query.minPrice || req.query.priceMin,
            priceMax: req.query.maxPrice || req.query.priceMax,
            minRating: req.query.minRating || req.query.rating,
            sale_enabled: req.query.sale_enabled,
            swap_enabled: req.query.swap_enabled,
            availability: req.query.availability || 'available'
        };

        const options = {
            sort: req.query.sort || 'newest',
            limit: parseInt(req.query.limit, 10) || 12,
            page: parseInt(req.query.page, 10) || 1
        };

        const result = await Book.findAll(filters, options);
        res.json(result);
    } catch (error) {
        console.error('[bookController.getBooks] ERROR:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getFeaturedBooks = async (req, res) => {
    try {
        const books = await Book.findFeatured();
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getBookById = async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // Increment views counter
        try {
            await pool.execute('UPDATE books SET views = views + 1 WHERE id = ?', [req.params.id]);
        } catch (e) {
            // Non-blocking
        }

        // Track user browsing activity if authenticated (deduplicate within 10 minutes)
        if (req.user && req.user.id) {
            try {
                const [recentViews] = await pool.query(
                    'SELECT id FROM user_activity WHERE user_id = ? AND activity_type = "view" AND reference_id = ? AND created_at >= NOW() - INTERVAL 10 MINUTE',
                    [req.user.id, book.id]
                );
                if (recentViews.length === 0) {
                    await pool.execute(
                        'INSERT INTO user_activity (user_id, activity_type, reference_id) VALUES (?, "view", ?)',
                        [req.user.id, book.id]
                    );
                }
            } catch (e) {
                // Non-blocking
            }
        }

        res.json(book);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getRelatedBooks = async (req, res) => {
    try {
        const books = await Book.findRelated(req.params.id);
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getMyBooks = async (req, res) => {
    try {
        const books = await Book.findByUserId(req.user.id);
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getSuggestions = async (req, res) => {
    try {
        const query = req.query.q || req.query.query || '';
        const results = await Book.getSuggestions(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const createBook = async (req, res) => {
    try {
        const bookData = {
            ...req.body,
            seller_id: req.user.id
        };
        
        const bookId = await Book.create(bookData);
        const newBook = await Book.findById(bookId);
        
        res.status(201).json(newBook);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const updateBook = async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (book.seller_id !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to edit this book' });
        }

        const mergedData = {
            ...book,
            ...req.body
        };

        await Book.update(req.params.id, mergedData);
        const updatedBook = await Book.findById(req.params.id);
        
        res.json(updatedBook);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const deleteBook = async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (book.seller_id !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to delete this book' });
        }

        await Book.delete(req.params.id);
        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getBooks,
    getFeaturedBooks,
    getBookById,
    getRelatedBooks,
    getMyBooks,
    getSuggestions,
    createBook,
    updateBook,
    deleteBook
};
