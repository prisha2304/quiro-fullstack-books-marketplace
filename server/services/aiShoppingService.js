const { pool } = require('../config/db');
const Book = require('../models/Book');
const AuditService = require('./auditService');
const AIComparisonService = require('./aiComparisonService');

class AIShoppingService {
    /**
     * Get compact cart summary for authenticated user
     */
    static async getCartContext(userId) {
        const numericId = parseInt(userId, 10);
        if (!numericId || isNaN(numericId)) return { items: [], subtotal: 0, itemCount: 0 };

        const [rows] = await pool.query(`
            SELECT c.id as cart_item_id, c.quantity, b.id as book_id, b.title, b.author, b.genre, 
                   b.price, b.condition, b.cover_image, b.rating
            FROM cart_items c
            JOIN books b ON c.book_id = b.id
            WHERE c.user_id = ?
        `, [numericId]);

        let subtotal = 0;
        let itemCount = 0;

        const items = rows.map(r => {
            const qty = parseInt(r.quantity || 1, 10);
            const price = parseFloat(r.price || 0);
            subtotal += price * qty;
            itemCount += qty;

            return {
                cartItemId: r.cart_item_id,
                bookId: r.book_id,
                title: r.title,
                author: r.author,
                genre: r.genre,
                price,
                quantity: qty,
                condition: r.condition,
                cover_image: r.cover_image,
                rating: parseFloat(r.rating || 4.5)
            };
        });

        return {
            items,
            subtotal: parseFloat(subtotal.toFixed(2)),
            itemCount
        };
    }

    /**
     * Get wishlist summary for authenticated user
     */
    static async getWishlistContext(userId) {
        const numericId = parseInt(userId, 10);
        if (!numericId || isNaN(numericId)) return { items: [], count: 0 };

        const [rows] = await pool.query(`
            SELECT w.id as wishlist_id, b.id as book_id, b.title, b.author, b.genre, 
                   b.price, b.condition, b.cover_image, b.rating
            FROM wishlists w
            JOIN books b ON w.book_id = b.id
            WHERE w.user_id = ?
        `, [numericId]);

        const items = rows.map(r => ({
            wishlistId: r.wishlist_id,
            bookId: r.book_id,
            title: r.title,
            author: r.author,
            genre: r.genre,
            price: parseFloat(r.price || 0),
            condition: r.condition,
            cover_image: r.cover_image,
            rating: parseFloat(r.rating || 4.5)
        }));

        return {
            items,
            count: items.length
        };
    }

    /**
     * Discover alternative books (CHEAPER, BETTER_RATED, BETTER_VALUE, SIMILAR)
     */
    static async getAlternativeBooks(bookId, type = 'CHEAPER') {
        const numericId = parseInt(bookId, 10);
        const book = await Book.findById(numericId);
        if (!book) return [];

        const price = parseFloat(book.price || 0);
        const rating = parseFloat(book.rating || 4.5);
        const genre = book.genre || 'Programming';

        let alternatives = [];

        if (type === 'CHEAPER') {
            const [rows] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.role as seller_role
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.id != ? AND b.genre = ? AND b.price < ? AND b.status = 'available'
                ORDER BY b.price ASC, b.rating DESC
                LIMIT 4
            `, [numericId, genre, price]);
            alternatives = rows;
        } else if (type === 'BETTER_RATED') {
            const [rows] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.role as seller_role
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.id != ? AND b.genre = ? AND b.rating > ? AND b.status = 'available'
                ORDER BY b.rating DESC, b.price ASC
                LIMIT 4
            `, [numericId, genre, rating]);
            alternatives = rows;
        } else {
            const [rows] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.role as seller_role
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.id != ? AND b.genre = ? AND b.status = 'available'
                ORDER BY b.rating DESC, b.views DESC
                LIMIT 4
            `, [numericId, genre]);
            alternatives = rows;
        }

        return alternatives;
    }

    /**
     * Smart Cart Analysis and Optimization Recommendations
     */
    static async optimizeCart(userId) {
        const cartContext = await this.getCartContext(userId);
        if (cartContext.items.length === 0) {
            return {
                currentTotal: 0,
                optimizedTotal: 0,
                potentialSavings: 0,
                suggestions: ['Your cart is currently empty. Add books to get optimization advice!']
            };
        }

        let potentialSavings = 0;
        const suggestions = [];

        for (const item of cartContext.items) {
            const cheaperAlternatives = await this.getAlternativeBooks(item.bookId, 'CHEAPER');
            if (cheaperAlternatives.length > 0) {
                const bestAlt = cheaperAlternatives[0];
                const diff = item.price - parseFloat(bestAlt.price);
                if (diff > 20) {
                    potentialSavings += diff * item.quantity;
                    suggestions.push(
                        `Replace "${item.title}" (₹${item.price}) with "${bestAlt.title}" (${bestAlt.condition || 'Like New'}, ₹${bestAlt.price}) to save ₹${Math.round(diff * item.quantity)}.`
                    );
                }
            }
        }

        if (suggestions.length === 0) {
            suggestions.push('Your cart is already well-optimized with competitive student prices!');
        }

        const optimizedTotal = Math.max(0, cartContext.subtotal - potentialSavings);

        return {
            currentTotal: cartContext.subtotal,
            optimizedTotal: parseFloat(optimizedTotal.toFixed(2)),
            potentialSavings: parseFloat(potentialSavings.toFixed(2)),
            suggestions
        };
    }

    /**
     * Execute safe shopping action on behalf of authenticated user
     */
    static async executeAction(userId, action, bookId, quantity = 1, req = null, payload = {}) {
        const numericUserId = parseInt(userId, 10);
        if (!numericUserId || isNaN(numericUserId)) {
            throw new Error('Authentication required for shopping actions');
        }

        const numericBookId = parseInt(bookId, 10);
        let book = null;
        if (numericBookId) {
            book = await Book.findById(numericBookId);
        }

        switch (action) {
            case 'ADD_TO_CART': {
                if (!book) throw new Error('Book not found');
                const qty = Math.max(1, parseInt(quantity, 10) || 1);

                const [existing] = await pool.query(
                    'SELECT id, quantity FROM cart_items WHERE user_id = ? AND book_id = ?',
                    [numericUserId, numericBookId]
                );

                if (existing.length > 0) {
                    await pool.execute(
                        'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
                        [qty, existing[0].id]
                    );
                } else {
                    await pool.execute(
                        'INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, ?)',
                        [numericUserId, numericBookId, qty]
                    );
                }

                await AuditService.log(numericUserId, 'AI_ADD_TO_CART', 'BOOK', numericBookId, { title: book.title, price: book.price }, req);

                return {
                    success: true,
                    action: 'ADD_TO_CART',
                    book,
                    message: `Added "${book.title}" to your cart!`,
                    redirect: '/cart'
                };
            }

            case 'ADD_BUNDLE_TO_CART': {
                const bookIds = Array.isArray(payload.bookIds) ? payload.bookIds : (numericBookId ? [numericBookId] : []);
                if (bookIds.length === 0) throw new Error('No books specified in bundle');

                let addedCount = 0;
                for (const bId of bookIds) {
                    const idNum = parseInt(bId, 10);
                    if (idNum) {
                        const [existing] = await pool.query(
                            'SELECT id FROM cart_items WHERE user_id = ? AND book_id = ?',
                            [numericUserId, idNum]
                        );
                        if (existing.length === 0) {
                            await pool.execute(
                                'INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, 1)',
                                [numericUserId, idNum]
                            );
                        }
                        addedCount++;
                    }
                }

                await AuditService.log(numericUserId, 'AI_BULK_CART_ACTION', 'BUNDLE', null, { bookCount: addedCount }, req);

                return {
                    success: true,
                    action: 'ADD_BUNDLE_TO_CART',
                    message: `Added ${addedCount} bundle book(s) directly to your cart!`,
                    redirect: '/cart'
                };
            }

            case 'REMOVE_FROM_CART': {
                if (!numericBookId) throw new Error('Book ID is required to remove from cart');
                
                await pool.execute(
                    'DELETE FROM cart_items WHERE user_id = ? AND book_id = ?',
                    [numericUserId, numericBookId]
                );

                await AuditService.log(numericUserId, 'AI_REMOVE_FROM_CART', 'BOOK', numericBookId, {}, req);

                return {
                    success: true,
                    action: 'REMOVE_FROM_CART',
                    book,
                    message: book ? `Removed "${book.title}" from your cart.` : 'Item removed from cart.',
                    redirect: '/cart'
                };
            }

            case 'ADD_TO_WISHLIST': {
                if (!book) throw new Error('Book not found');

                const [existing] = await pool.query(
                    'SELECT id FROM wishlists WHERE user_id = ? AND book_id = ?',
                    [numericUserId, numericBookId]
                );

                if (existing.length === 0) {
                    await pool.execute(
                        'INSERT INTO wishlists (user_id, book_id) VALUES (?, ?)',
                        [numericUserId, numericBookId]
                    );
                }

                await AuditService.log(numericUserId, 'AI_ADD_TO_WISHLIST', 'BOOK', numericBookId, { title: book.title }, req);

                return {
                    success: true,
                    action: 'ADD_TO_WISHLIST',
                    book,
                    message: `Saved "${book.title}" to your wishlist!`,
                    redirect: '/wishlist'
                };
            }

            case 'REMOVE_FROM_WISHLIST': {
                if (!numericBookId) throw new Error('Book ID is required');

                await pool.execute(
                    'DELETE FROM wishlists WHERE user_id = ? AND book_id = ?',
                    [numericUserId, numericBookId]
                );

                await AuditService.log(numericUserId, 'AI_REMOVE_FROM_WISHLIST', 'BOOK', numericBookId, {}, req);

                return {
                    success: true,
                    action: 'REMOVE_FROM_WISHLIST',
                    book,
                    message: book ? `Removed "${book.title}" from your wishlist.` : 'Item removed from wishlist.',
                    redirect: '/wishlist'
                };
            }

            case 'START_CHECKOUT': {
                await AuditService.log(numericUserId, 'AI_CHECKOUT_REDIRECT', 'CHECKOUT', null, {}, req);
                return {
                    success: true,
                    action: 'START_CHECKOUT',
                    message: 'Your cart is prepared. Proceeding to secure checkout...',
                    redirect: '/checkout'
                };
            }

            default:
                throw new Error(`Unsupported action: ${action}`);
        }
    }
}

module.exports = AIShoppingService;
