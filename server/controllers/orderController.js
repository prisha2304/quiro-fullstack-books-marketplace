const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { generateInvoicePDF } = require('../services/invoiceService');
const socket = require('../socket');
const { pool } = require('../config/db');

const createOrder = async (req, res) => {
    try {
        const { shipping_address } = req.body;
        
        const cartItems = await Cart.findByUserId(req.user.id);
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        let subtotal = 0;
        const items = [];
        
        for (const item of cartItems) {
            const qty = parseInt(item.quantity) || 1;
            subtotal += parseFloat(item.price) * qty;
            
            for (let i = 0; i < qty; i++) {
                items.push({
                    id: item.id,
                    price: parseFloat(item.price),
                    title: item.title
                });
            }
        }

        const shipping = subtotal > 500 ? 0 : 50;
        const gst = subtotal * 0.05;
        const platformFee = 29;
        const total_price = subtotal + shipping + gst + platformFee;

        const orderId = await Order.create({
            buyer_id: req.user.id,
            total_price: parseFloat(total_price.toFixed(2)),
            shipping_address,
            items
        });

        // Trigger real-time notifications for sellers
        for (const item of cartItems) {
            const [books] = await pool.execute('SELECT seller_id, title FROM books WHERE id = ?', [item.id]);
            if (books.length > 0) {
                socket.sendNotification(books[0].seller_id, {
                    type: 'NEW_ORDER',
                    title: 'New Order Received',
                    message: `You received an order for "${books[0].title}" (#BN-${orderId})`,
                    reference_id: orderId
                });
            }
        }

        // Notification for buyer
        socket.sendNotification(req.user.id, {
            type: 'ORDER_PLACED',
            title: 'Order Confirmed',
            message: `Your order #BN-${orderId} has been confirmed successfully!`,
            reference_id: orderId
        });

        res.status(201).json({ message: 'Order placed successfully', orderId });
    } catch (error) {
        res.status(400).json({ message: 'Checkout failed', error: error.message });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.findByUserId(req.user.id);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};

const getSellerOrders = async (req, res) => {
    try {
        const orders = await Order.findBySellerId(req.user.id);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching seller orders', error: error.message });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is buyer, seller of an item in order, or admin
        const isBuyer = order.buyer_id === req.user.id;
        const isSeller = order.items && order.items.some(item => item.seller_id === req.user.id);
        const isAdmin = req.user.role === 'ADMIN';

        if (!isBuyer && !isSeller && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order details', error: error.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, tracking_number } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Authorization: seller of items or admin
        const isSeller = order.items && order.items.some(item => item.seller_id === req.user.id);
        const isAdmin = req.user.role === 'ADMIN';

        if (!isSeller && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        await Order.updateStatus(id, status, tracking_number);

        // Send notifications & socket event to buyer
        let notificationTitle = 'Order Update';
        let notificationMsg = `Your order #BN-${id} status changed to ${status.toUpperCase()}`;

        if (status === 'packed') {
            notificationTitle = 'Order Packed';
            notificationMsg = `Your order #BN-${id} has been packed and is ready for dispatch!`;
        } else if (status === 'shipped') {
            notificationTitle = 'Order Shipped';
            notificationMsg = `Your order #BN-${id} is on the way! ${tracking_number ? `Tracking: ${tracking_number}` : ''}`;
        } else if (status === 'out_for_delivery') {
            notificationTitle = 'Out For Delivery';
            notificationMsg = `Your order #BN-${id} is out for delivery today!`;
        } else if (status === 'delivered') {
            notificationTitle = 'Order Delivered';
            notificationMsg = `Your order #BN-${id} was delivered successfully. Enjoy your read!`;
        } else if (status === 'cancelled') {
            notificationTitle = 'Order Cancelled';
            notificationMsg = `Your order #BN-${id} has been cancelled.`;
        }

        try {
            await pool.execute(
                'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?)',
                [order.buyer_id, notificationTitle, notificationMsg, 'ORDER_UPDATE', id]
            );
        } catch (e) {}

        socket.sendNotification(order.buyer_id, {
            type: 'ORDER_UPDATE',
            title: notificationTitle,
            message: notificationMsg,
            reference_id: id,
            status
        });

        const updatedOrder = await Order.findById(id);
        res.json({ message: `Order status updated to ${status}`, order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(400).json({ message: 'Failed to update order status', error: error.message });
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Authorization check
        const isBuyer = order.buyer_id === req.user.id;
        const isSeller = order.items && order.items.some(item => item.seller_id === req.user.id);
        const isAdmin = req.user.role === 'ADMIN';

        if (!isBuyer && !isSeller && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to download invoice for this order' });
        }

        const { filePath, filename, invoiceNum } = await generateInvoicePDF({
            order,
            items: order.items || []
        });

        // Store invoice path if not already stored
        try {
            await pool.execute('UPDATE orders SET invoice_number = ?, invoice_path = ? WHERE id = ?', 
                [invoiceNum, filePath, id]);
        } catch (e) {}

        res.download(filePath, `QUIRO_Invoice_${order.id}.pdf`);
    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).json({ message: 'Error generating invoice', error: error.message });
    }
};

const cancelOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const [orders] = await connection.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }
        const order = orders[0];

        // Only buyer (or admin) can cancel via this endpoint
        if (order.buyer_id !== req.user.id && req.user.role !== 'ADMIN') {
            await connection.rollback();
            return res.status(403).json({ message: 'Not authorized to cancel this order' });
        }

        // Only pending or confirmed orders can be cancelled (before dispatch/packing)
        if (order.status !== 'pending' && order.status !== 'confirmed') {
            await connection.rollback();
            return res.status(400).json({ 
                message: `Cannot cancel an order in '${order.status}' status. Only pending or confirmed orders can be cancelled.` 
            });
        }

        // Update order status to 'cancelled'
        await connection.execute('UPDATE orders SET status = "cancelled" WHERE id = ?', [id]);

        // Release inventory back to available and release reservations
        await connection.execute('UPDATE inventory_reservations SET status = "RELEASED" WHERE order_id = ?', [id]);
        const [orderItems] = await connection.execute('SELECT book_id FROM order_items WHERE order_id = ?', [id]);
        for (const item of orderItems) {
            await connection.execute('UPDATE books SET status = "available" WHERE id = ?', [item.book_id]);
        }

        // Update payment status if exists
        try {
            await connection.execute('UPDATE payments SET status = "refunded" WHERE order_id = ?', [id]);
        } catch (e) {}

        // Notify seller(s)
        const [itemsWithSeller] = await connection.execute(`
            SELECT DISTINCT b.seller_id, b.title 
            FROM order_items oi 
            JOIN books b ON oi.book_id = b.id 
            WHERE oi.order_id = ?
        `, [id]);

        for (const item of itemsWithSeller) {
            socket.sendNotification(item.seller_id, {
                type: 'ORDER_CANCELLED',
                title: 'Order Cancelled by Buyer',
                message: `Order #BN-${id} containing "${item.title}" was cancelled by the buyer.`,
                reference_id: id
            });
        }

        // Commit transaction
        await connection.commit();

        socket.sendNotification(order.buyer_id, {
            type: 'ORDER_UPDATE',
            title: 'Order Cancelled',
            message: `Your order #BN-${id} has been cancelled successfully.`,
            reference_id: id,
            status: 'cancelled'
        });

        res.json({ message: 'Order cancelled successfully', orderId: id, status: 'cancelled' });
    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Failed to cancel order', error: error.message });
    } finally {
        connection.release();
    }
};

const requestRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, amount } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'Refund reason is required' });
        }

        const [orderRows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orderRows[0];
        if (order.buyer_id !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to request refund for this order' });
        }

        const eligibleStatuses = ['confirmed', 'processing', 'packed', 'ready_to_ship', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];
        if (!eligibleStatuses.includes(order.status)) {
            return res.status(400).json({ 
                message: `Cannot request refund for order in "${order.status}" status.` 
            });
        }

        // Get payment
        const [paymentRows] = await pool.execute('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [id]);
        if (paymentRows.length === 0) {
            return res.status(400).json({ message: 'No payment record found for this order' });
        }

        const payment = paymentRows[0];
        const refundAmount = parseFloat(amount || payment.amount);

        // Check if pending request exists
        const [existing] = await pool.execute(
            'SELECT * FROM payment_refunds WHERE order_id = ? AND status IN ("REFUND_REQUESTED", "REFUND_PROCESSING")',
            [id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'A refund request is already pending review for this order' });
        }

        const [result] = await pool.execute(`
            INSERT INTO payment_refunds (payment_id, order_id, user_id, amount, reason, status)
            VALUES (?, ?, ?, ?, ?, 'REFUND_REQUESTED')
        `, [payment.id, id, req.user.id, refundAmount, reason]);

        socket.sendNotification(req.user.id, {
            type: 'REFUND_REQUESTED',
            title: 'Refund Request Submitted',
            message: `Your refund request of ₹${refundAmount} for Order #BN-${id} has been received and is under review.`,
            reference_id: id
        });

        res.status(201).json({
            success: true,
            message: 'Refund request submitted successfully and is currently under review.',
            refundId: result.insertId,
            status: 'REFUND_REQUESTED'
        });
    } catch (error) {
        console.error('Refund request error:', error);
        res.status(500).json({ message: 'Failed to submit refund request', error: error.message });
    }
};

const getOrderRefundStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(`
            SELECT pr.*, p.razorpay_payment_id, p.status as payment_status
            FROM payment_refunds pr
            LEFT JOIN payments p ON pr.payment_id = p.id
            WHERE pr.order_id = ?
            ORDER BY pr.id DESC LIMIT 1
        `, [id]);

        if (rows.length === 0) {
            return res.json({ hasRefund: false });
        }

        res.json({ hasRefund: true, refund: rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch refund status', error: error.message });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getSellerOrders,
    getOrderById,
    updateOrderStatus,
    downloadInvoice,
    cancelOrder,
    requestRefund,
    getOrderRefundStatus
};
