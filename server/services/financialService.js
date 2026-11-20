const { pool } = require('../config/db');

class FinancialService {
    // -------------------------------------------------------------
    // Seller Financial Analytics & Ledger
    // -------------------------------------------------------------
    static async getSellerFinancialOverview(sellerId) {
        // Gross sales from confirmed orders containing seller's books
        const [grossRows] = await pool.execute(`
            SELECT 
                COALESCE(SUM(sp.gross_amount), 0) as gross_sales,
                COALESCE(SUM(sp.platform_fee), 0) as total_platform_fees,
                COALESCE(SUM(sp.seller_amount), 0) as net_earnings,
                COALESCE(SUM(CASE WHEN sp.payout_status = 'PENDING' THEN sp.seller_amount ELSE 0 END), 0) as pending_payouts,
                COALESCE(SUM(CASE WHEN sp.payout_status = 'PAID' THEN sp.seller_amount ELSE 0 END), 0) as completed_payouts,
                COALESCE(SUM(CASE WHEN sp.payout_status = 'REVERSED' THEN sp.seller_amount ELSE 0 END), 0) as reversed_earnings,
                COUNT(sp.id) as total_transactions
            FROM seller_payouts sp
            WHERE sp.seller_id = ?
        `, [sellerId]);

        // Monthly trends for seller
        const [trendRows] = await pool.execute(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                SUM(gross_amount) as monthly_gross,
                SUM(seller_amount) as monthly_net,
                COUNT(id) as order_count
            FROM seller_payouts
            WHERE seller_id = ?
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month DESC
            LIMIT 12
        `, [sellerId]);

        return {
            summary: grossRows[0] || {
                gross_sales: 0,
                total_platform_fees: 0,
                net_earnings: 0,
                pending_payouts: 0,
                completed_payouts: 0,
                reversed_earnings: 0,
                total_transactions: 0
            },
            monthlyTrends: trendRows.reverse()
        };
    }

    static async getSellerTransactions(sellerId, limit = 20, offset = 0) {
        const lim = parseInt(limit, 10) || 20;
        const off = parseInt(offset, 10) || 0;

        const [rows] = await pool.execute(`
            SELECT 
                sp.id, sp.order_id, sp.payment_id, sp.gross_amount, sp.platform_fee, sp.seller_amount,
                sp.payout_status, sp.payout_reference, sp.created_at, sp.paid_at,
                o.invoice_number,
                (SELECT GROUP_CONCAT(b.title SEPARATOR ', ') 
                 FROM order_items oi 
                 JOIN books b ON oi.book_id = b.id 
                 WHERE oi.order_id = sp.order_id AND b.seller_id = sp.seller_id) as book_titles
            FROM seller_payouts sp
            JOIN orders o ON sp.order_id = o.id
            WHERE sp.seller_id = ?
            ORDER BY sp.created_at DESC
            LIMIT ${lim} OFFSET ${off}
        `, [sellerId]);

        return rows;
    }

    // -------------------------------------------------------------
    // Admin Financial Analytics & Metrics
    // -------------------------------------------------------------
    static async getAdminFinancialOverview() {
        // High-level aggregates
        const [summaryRows] = await pool.execute(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'CAPTURED' THEN amount ELSE 0 END), 0) as gross_merchandise_value,
                COALESCE(SUM(CASE WHEN status = 'CAPTURED' THEN amount ELSE 0 END), 0) as total_captured_volume,
                COALESCE(SUM(CASE WHEN status = 'FAILED' THEN amount ELSE 0 END), 0) as failed_volume,
                COALESCE(SUM(refund_amount), 0) as total_refunds,
                COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) as captured_count,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
                COUNT(CASE WHEN status IN ('REFUNDED', 'PARTIALLY_REFUNDED') THEN 1 END) as refund_count,
                COUNT(id) as total_payments
            FROM payments
        `);

        // Platform fee and seller liability
        const [payoutRows] = await pool.execute(`
            SELECT 
                COALESCE(SUM(platform_fee), 0) as total_platform_fees,
                COALESCE(SUM(seller_amount), 0) as total_seller_earnings,
                COALESCE(SUM(CASE WHEN payout_status = 'PENDING' THEN seller_amount ELSE 0 END), 0) as pending_seller_payouts,
                COALESCE(SUM(CASE WHEN payout_status = 'PAID' THEN seller_amount ELSE 0 END), 0) as completed_seller_payouts
            FROM seller_payouts
        `);

        const summary = summaryRows[0];
        const payouts = payoutRows[0];

        const gmv = parseFloat(summary.gross_merchandise_value || 0);
        const refunds = parseFloat(summary.total_refunds || 0);
        const platformFees = parseFloat(payouts.total_platform_fees || 0);
        const netMarketplaceRevenue = parseFloat((platformFees).toFixed(2));
        const totalPayments = parseInt(summary.total_payments || 0);
        const capturedCount = parseInt(summary.captured_count || 0);

        const successRate = totalPayments > 0 ? parseFloat(((capturedCount / totalPayments) * 100).toFixed(1)) : 100;
        const refundRate = capturedCount > 0 ? parseFloat(((parseInt(summary.refund_count || 0) / capturedCount) * 100).toFixed(1)) : 0;

        // Daily volume trends for last 30 days
        const [dailyTrends] = await pool.execute(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m-%d') as date,
                SUM(CASE WHEN status = 'CAPTURED' THEN amount ELSE 0 END) as captured_amount,
                SUM(CASE WHEN status = 'FAILED' THEN amount ELSE 0 END) as failed_amount,
                SUM(refund_amount) as refund_amount,
                COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) as successful_count,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count
            FROM payments
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
            ORDER BY date ASC
        `);

        return {
            metrics: {
                grossMerchandiseValue: gmv,
                totalCapturedVolume: parseFloat(summary.total_captured_volume || 0),
                failedVolume: parseFloat(summary.failed_volume || 0),
                totalRefunds: refunds,
                netMarketplaceRevenue,
                totalPlatformFees: platformFees,
                totalSellerEarnings: parseFloat(payouts.total_seller_earnings || 0),
                pendingSellerPayouts: parseFloat(payouts.pending_seller_payouts || 0),
                completedSellerPayouts: parseFloat(payouts.completed_seller_payouts || 0),
                paymentSuccessRate: successRate,
                refundRate: refundRate,
                totalPaymentsCount: totalPayments,
                capturedPaymentsCount: capturedCount
            },
            trends: dailyTrends
        };
    }

    // -------------------------------------------------------------
    // Append-Only Financial Ledger Querying
    // -------------------------------------------------------------
    static async getFinancialLedger({ transactionType, limit = 50, offset = 0 }) {
        const lim = parseInt(limit, 10) || 50;
        const off = parseInt(offset, 10) || 0;

        let query = `
            SELECT fl.*, 
                   u.full_name as user_name, u.email as user_email,
                   s.full_name as seller_name, s.email as seller_email,
                   o.invoice_number
            FROM financial_ledger fl
            LEFT JOIN users u ON fl.user_id = u.id
            LEFT JOIN users s ON fl.seller_id = s.id
            LEFT JOIN orders o ON fl.order_id = o.id
        `;
        const params = [];

        if (transactionType) {
            query += ' WHERE fl.transaction_type = ?';
            params.push(transactionType);
        }

        query += ` ORDER BY fl.created_at DESC LIMIT ${lim} OFFSET ${off}`;

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // -------------------------------------------------------------
    // Admin Payout Processing
    // -------------------------------------------------------------
    static async updateSellerPayoutStatus(payoutId, { status, referenceNumber, adminId }) {
        const validStatuses = ['PENDING', 'ELIGIBLE', 'PROCESSING', 'PAID', 'ON_HOLD', 'REVERSED'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid payout status: ${status}`);
        }

        const [payoutRows] = await pool.execute('SELECT * FROM seller_payouts WHERE id = ?', [payoutId]);
        if (payoutRows.length === 0) throw new Error('Payout record not found');

        const payout = payoutRows[0];
        const paidAt = status === 'PAID' ? 'CURRENT_TIMESTAMP' : 'NULL';

        await pool.execute(`
            UPDATE seller_payouts 
            SET payout_status = ?, 
                payout_reference = COALESCE(?, payout_reference),
                paid_at = ${status === 'PAID' ? 'CURRENT_TIMESTAMP' : 'paid_at'}
            WHERE id = ?
        `, [status, referenceNumber || null, payoutId]);

        // If newly marked PAID, append PAYOUT entry to ledger
        if (status === 'PAID') {
            const txId = `TX_PAYOUT_${payoutId}_${Date.now().toString().slice(-6)}`;
            await pool.execute(`
                INSERT INTO financial_ledger (transaction_id, order_id, payment_id, seller_id, transaction_type, amount, currency, direction, status, metadata)
                VALUES (?, ?, ?, ?, 'PAYOUT', ?, 'INR', 'DEBIT', 'COMPLETED', ?)
            `, [txId, payout.order_id, payout.payment_id, payout.seller_id, payout.seller_amount, JSON.stringify({ referenceNumber, processedBy: adminId })]);
        }

        return { success: true, payoutId, status };
    }
}

module.exports = FinancialService;
