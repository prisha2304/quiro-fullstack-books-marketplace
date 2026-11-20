const { pool } = require('../config/db');

class Order {
    static async create(orderData) {
        const { buyer_id, total_price, shipping_address, items } = orderData;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const invoiceNum = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

            // 1. Insert order with confirmed/pending status and invoice number
            const [orderResult] = await connection.execute(
                'INSERT INTO orders (buyer_id, total_price, shipping_address, status, invoice_number) VALUES (?, ?, ?, ?, ?)',
                [buyer_id, total_price, shipping_address, 'confirmed', invoiceNum]
            );
            const orderId = orderResult.insertId;

            // 2. Insert items and update book status
            const processedBookIds = new Set();
            for (const item of items) {
                await connection.execute(
                    'INSERT INTO order_items (order_id, book_id, price) VALUES (?, ?, ?)',
                    [orderId, item.id, item.price]
                );

                if (!processedBookIds.has(item.id)) {
                    const [updateResult] = await connection.execute(
                        "UPDATE books SET status = 'sold' WHERE id = ? AND status = 'available'",
                        [item.id]
                    );

                    if (updateResult.affectedRows === 0) {
                        throw new Error(`Book "${item.title}" is no longer available`);
                    }
                    processedBookIds.add(item.id);
                }
            }

            // 3. Clear cart
            await connection.execute('DELETE FROM cart_items WHERE user_id = ?', [buyer_id]);

            await connection.commit();
            return orderId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async createPending(orderData) {
        const { buyer_id, total_price, shipping_address, items } = orderData;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const invoiceNum = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

            const [orderResult] = await connection.execute(
                'INSERT INTO orders (buyer_id, total_price, shipping_address, status, invoice_number) VALUES (?, ?, ?, ?, ?)',
                [buyer_id, total_price, shipping_address, 'pending', invoiceNum]
            );
            const orderId = orderResult.insertId;

            for (const item of items) {
                await connection.execute(
                    'INSERT INTO order_items (order_id, book_id, price) VALUES (?, ?, ?)',
                    [orderId, item.id, item.price]
                );
            }

            await connection.commit();
            return orderId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async confirmPayment(orderId, paymentDetails) {
        const { buyer_id, payment_id, order_id, signature, method, amount } = paymentDetails;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Update order status to confirmed
            await connection.execute(
                "UPDATE orders SET status = 'confirmed' WHERE id = ?",
                [orderId]
            );

            // 2. Load order items to mark books as sold
            const [items] = await connection.execute(
                "SELECT book_id, price FROM order_items WHERE order_id = ?",
                [orderId]
            );

            for (const item of items) {
                const [updateResult] = await connection.execute(
                    "UPDATE books SET status = 'sold' WHERE id = ? AND status = 'available'",
                    [item.book_id]
                );
                if (updateResult.affectedRows === 0) {
                     throw new Error(`Book ID ${item.book_id} is no longer available`);
                }
            }

            // 3. Clear cart
            await connection.execute(
                'DELETE FROM cart_items WHERE user_id = ?',
                [buyer_id]
            );

            // 4. Record payment log
            await connection.execute(
                'INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, status, amount, method, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [orderId, order_id, payment_id, signature, 'paid', amount, method]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findByUserId(userId) {
        const [orders] = await pool.execute(`
            SELECT o.*, 
                   COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.buyer_id = ? 
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [userId]);

        for (const ord of orders) {
            const [itemRows] = await pool.execute(`
                SELECT oi.*, b.title, b.author, b.cover_image, b.genre, u.full_name as seller_name, u.id as seller_id
                FROM order_items oi
                JOIN books b ON oi.book_id = b.id
                JOIN users u ON b.seller_id = u.id
                WHERE oi.order_id = ?
            `, [ord.id]);
            ord.items = itemRows;
        }

        return orders;
    }

    static async findBySellerId(sellerId) {
        const [rows] = await pool.execute(`
            SELECT 
                o.id as order_id, 
                o.total_price, 
                o.shipping_address, 
                o.status, 
                o.tracking_number,
                o.invoice_number,
                o.created_at, 
                o.updated_at,
                u.id as buyer_id,
                u.full_name as buyer_name, 
                u.email as buyer_email, 
                u.phone as buyer_phone,
                b.id as book_id,
                b.title as book_title, 
                b.author as book_author, 
                b.cover_image,
                oi.price as item_price
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            JOIN users u ON o.buyer_id = u.id
            WHERE b.seller_id = ?
            ORDER BY o.created_at DESC
        `, [sellerId]);

        return rows;
    }

    static async findById(id) {
        const [orderRows] = await pool.execute(`
            SELECT o.*, u.full_name as buyer_name, u.email as buyer_email, u.phone as buyer_phone
            FROM orders o
            JOIN users u ON o.buyer_id = u.id
            WHERE o.id = ?
        `, [id]);
        
        if (!orderRows[0]) return null;

        const [itemRows] = await pool.execute(`
            SELECT oi.*, b.title, b.author, b.cover_image, b.genre, b.seller_id, u.full_name as seller_name, u.email as seller_email
            FROM order_items oi
            JOIN books b ON oi.book_id = b.id
            JOIN users u ON b.seller_id = u.id
            WHERE oi.order_id = ?
        `, [id]);

        const [payments] = await pool.execute(
            'SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC LIMIT 1',
            [id]
        );

        return {
            ...orderRows[0],
            items: itemRows,
            payment: payments[0] || null
        };
    }

    static async updateStatus(orderId, newStatus, trackingNumber = null) {
        const validStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }

        let query = 'UPDATE orders SET status = ?';
        const params = [newStatus];

        if (trackingNumber) {
            query += ', tracking_number = ?';
            params.push(trackingNumber);
        }

        query += ' WHERE id = ?';
        params.push(orderId);

        await pool.execute(query, params);

        // If cancelled, restore book status to 'available'
        if (newStatus === 'cancelled') {
            const [items] = await pool.execute('SELECT book_id FROM order_items WHERE order_id = ?', [orderId]);
            for (const item of items) {
                await pool.execute("UPDATE books SET status = 'available' WHERE id = ?", [item.book_id]);
            }
        }

        return true;
    }
}

module.exports = Order;
