const express = require('express');
const router = express.Router();
const { validateCoupon } = require('../controllers/couponController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/validate', validateCoupon);

module.exports = router;
