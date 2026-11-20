const { pool } = require('../config/db');

const validateCoupon = async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ message: 'Coupon code is required' });
        }
        
        const [rows] = await pool.execute(
            'SELECT * FROM coupons WHERE code = ? AND active = TRUE',
            [code.trim().toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Invalid or inactive coupon code' });
        }

        const coupon = rows[0];
        
        // Return coupon details
        res.json({
            valid: true,
            code: coupon.code,
            discount_percent: coupon.discount_percent,
            max_discount: coupon.max_discount,
            min_order_value: coupon.min_order_value
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    validateCoupon
};
