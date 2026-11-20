const express = require('express');
const router = express.Router();
const { 
    getDiscoverSwapBooks,
    getUserSwapEligibleBooks,
    requestSwap, 
    getIncomingRequests, 
    getOutgoingRequests, 
    getSwapHistory, 
    handleStatusUpdate,
    counterSwap,
    getMySwapListings,
    getCompletedSwaps,
    confirmSwapCompletion,
    getSwapDetails,
    selectExchangeMethod,
    giveConsent,
    markArranged,
    saveAddress,
    createManagedPayment,
    verifyManagedPayment,
    advanceCourier,
    refundSwap,
    getExchangeConfig
} = require('../controllers/swapController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// Public / Semi-public discoverable swap listings & config
router.get('/discover', optionalAuth, getDiscoverSwapBooks);
router.get('/config', optionalAuth, getExchangeConfig);

// Protected routes (require user login)
router.use(protect);

router.get('/my-eligible', getUserSwapEligibleBooks);
router.get('/my-listings', getMySwapListings);
router.get('/completed', getCompletedSwaps);
router.post('/request', requestSwap);
router.get('/incoming', getIncomingRequests);
router.get('/outgoing', getOutgoingRequests);
router.get('/history', getSwapHistory);

// Status actions
router.put('/:id/accept', (req, res) => { req.body.status = 'accepted'; handleStatusUpdate(req, res); });
router.put('/:id/reject', (req, res) => { req.body.status = 'rejected'; handleStatusUpdate(req, res); });
router.put('/:id/cancel', (req, res) => { req.body.status = 'cancelled'; handleStatusUpdate(req, res); });
router.put('/:id/complete', (req, res) => { req.body.status = 'completed'; handleStatusUpdate(req, res); });
router.post('/:id/confirm-completion', confirmSwapCompletion);
router.put('/:id/confirm', confirmSwapCompletion);
router.put('/:id/confirm-completion', confirmSwapCompletion);
router.put('/:id/counter', counterSwap);

// Post-acceptance exchange method & fulfillment routes
router.get('/:id/details', getSwapDetails);
router.get('/:id', getSwapDetails);
router.post('/:id/select-method', selectExchangeMethod);
router.post('/:id/consent', giveConsent);
router.post('/:id/arrange', markArranged);
router.post('/:id/address', saveAddress);
router.post('/:id/create-payment', createManagedPayment);
router.post('/:id/verify-payment', verifyManagedPayment);
router.post('/:id/advance-courier', advanceCourier);
router.post('/:id/refund', refundSwap);

module.exports = router;
