const Swap = require('../models/Swap');
const Book = require('../models/Book');

const getDiscoverSwapBooks = async (req, res) => {
    try {
        const currentUserId = req.user ? req.user.id : null;
        const options = {
            limit: parseInt(req.query.limit, 10) || 24,
            page: parseInt(req.query.page, 10) || 1,
            genre: req.query.genre || null,
            condition: req.query.condition || null,
            search: req.query.search || null
        };
        const result = await Swap.getDiscoverable(currentUserId, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching discoverable swap listings', error: error.message });
    }
};

const getUserSwapEligibleBooks = async (req, res) => {
    try {
        const [books] = await require('../config/db').pool.execute(
            'SELECT id, title, author, cover_image, genre, `condition`, price FROM books WHERE seller_id = ? AND status = "available" ORDER BY title ASC',
            [req.user.id]
        );
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your eligible swap books', error: error.message });
    }
};

const requestSwap = async (req, res) => {
    try {
        const { requested_book_id, offered_book_id, message } = req.body;
        
        if (!requested_book_id || !offered_book_id) {
            return res.status(400).json({ message: 'Both requested book and offered book are required' });
        }

        if (parseInt(requested_book_id, 10) === parseInt(offered_book_id, 10)) {
            return res.status(400).json({ message: 'You cannot swap a book with itself' });
        }

        const requestedBook = await Book.findById(requested_book_id);
        if (!requestedBook || !requestedBook.swap_enabled || requestedBook.status !== 'available') {
            return res.status(400).json({ message: 'Requested book is not available for swapping' });
        }

        if (parseInt(requestedBook.seller_id, 10) === parseInt(req.user.id, 10)) {
            return res.status(400).json({ message: 'You cannot request an exchange for your own listing' });
        }

        const offeredBook = await Book.findById(offered_book_id);
        if (!offeredBook || parseInt(offeredBook.seller_id, 10) !== parseInt(req.user.id, 10)) {
            return res.status(403).json({ message: 'You can only offer books that belong to your account' });
        }
        if (offeredBook.status !== 'available') {
             return res.status(400).json({ message: 'The offered book must be currently available' });
        }

        const swapId = await Swap.create({
            requester_id: req.user.id,
            owner_id: requestedBook.seller_id,
            requested_book_id,
            offered_book_id,
            message
        });

        // Real-time Notification via Socket
        try {
            const socket = require('../socket');
            socket.sendNotification(requestedBook.seller_id, {
                type: 'NEW_SWAP_REQUEST',
                message: `New swap proposal for your book "${requestedBook.title}"`,
                reference_id: swapId
            });
        } catch (sockErr) {
            // Non-blocking
        }

        res.status(201).json({ 
            message: 'Swap exchange proposal submitted successfully', 
            swapId 
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getIncomingRequests = async (req, res) => {
    try {
        const requests = await Swap.findIncoming(req.user.id);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching incoming requests', error: error.message });
    }
};

const getOutgoingRequests = async (req, res) => {
    try {
        const requests = await Swap.findOutgoing(req.user.id);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching outgoing requests', error: error.message });
    }
};

const getSwapHistory = async (req, res) => {
    try {
        const history = await Swap.findHistory(req.user.id);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching swap history', error: error.message });
    }
};

const handleStatusUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['accepted', 'rejected', 'cancelled', 'completed', 'dispatched', 'received'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: `Invalid swap status '${status}'. Must be one of: ${validStatuses.join(', ')}` 
            });
        }
        
        const swap = await Swap.findById(id);
        if (!swap) return res.status(404).json({ message: 'Swap request not found' });

        const isRequester = parseInt(swap.requester_id, 10) === parseInt(req.user.id, 10);
        const isOwner = parseInt(swap.owner_id, 10) === parseInt(req.user.id, 10);

        // Security / Authorization
        if (status === 'cancelled' && !isRequester) {
            return res.status(403).json({ message: 'Only the original requester can cancel this proposal' });
        }
        if ((status === 'accepted' || status === 'rejected') && !isOwner) {
            return res.status(403).json({ message: 'Only the book owner can accept or decline this request' });
        }
        if (['completed', 'dispatched', 'received'].includes(status) && (!isRequester && !isOwner)) {
            return res.status(403).json({ message: 'Only involved readers can update fulfillment status' });
        }

        if (status === 'accepted' && swap.status !== 'pending' && swap.status !== 'counter_offered') {
            return res.status(400).json({ message: `Cannot accept this exchange because its current status is '${swap.status}'.` });
        }

        await Swap.updateStatus(id, status, req.user.id);

        // Real-time Notification
        try {
            const socket = require('../socket');
            const receiverId = isRequester ? swap.owner_id : swap.requester_id;
            
            socket.sendNotification(receiverId, {
                type: `SWAP_${status.toUpperCase()}`,
                message: `Swap request for "${swap.requested_title || 'your book'}" has been ${status}`,
                reference_id: id
            });
        } catch (sockErr) {
            // Non-blocking
        }

        res.json({ message: `Swap marked as ${status}`, swapId: id, status });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Error updating swap status' });
    }
};

const counterSwap = async (req, res) => {
    try {
        const { id } = req.params;
        const { offered_book_id } = req.body;
        if (!offered_book_id) {
            return res.status(400).json({ message: 'Proposed counter book ID is required' });
        }
        await Swap.counter(id, offered_book_id, req.user.id);
        res.json({ message: 'Counter-offer proposed successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMySwapListings = async (req, res) => {
    try {
        const listings = await Swap.getMyListings(req.user.id);
        res.json(listings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your swap listings', error: error.message });
    }
};

const getCompletedSwaps = async (req, res) => {
    try {
        const completed = await Swap.getCompletedSwaps(req.user.id);
        res.json(completed);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching completed swaps', error: error.message });
    }
};

const confirmSwapCompletion = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Swap.confirmCompletion(id, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Failed to confirm swap completion' });
    }
};

// -------------------------------------------------------------
// Extended Exchange Workflow Controllers
// -------------------------------------------------------------
const getSwapDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const details = await Swap.getSwapDetails(id, req.user.id);
        if (!details) {
            return res.status(404).json({ message: 'Swap exchange not found' });
        }
        res.json(details);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
};

const selectExchangeMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const { method } = req.body;
        if (!method) {
            return res.status(400).json({ message: 'Exchange method is required (SELF_ARRANGED or QUIRO_MANAGED)' });
        }
        const updated = await Swap.selectMethod(id, req.user.id, method);

        // Real-time broadcast
        try {
            const socket = require('../socket');
            const partnerId = parseInt(req.user.id, 10) === parseInt(updated.requester_id, 10) ? updated.owner_id : updated.requester_id;
            socket.sendNotification(partnerId, {
                type: 'SWAP_METHOD_UPDATED',
                message: `Partner selected exchange method: ${method === 'SELF_ARRANGED' ? 'Direct Self-Arranged' : 'QUIRO Managed Courier'}`,
                reference_id: id
            });
        } catch (sockErr) {}

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const giveConsent = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Swap.recordConsent(id, req.user.id);

        try {
            const socket = require('../socket');
            const partnerId = parseInt(req.user.id, 10) === parseInt(updated.requester_id, 10) ? updated.owner_id : updated.requester_id;
            socket.sendNotification(partnerId, {
                type: 'SWAP_CONSENT_GRANTED',
                message: 'Your swap partner gave consent to share verified contact information.',
                reference_id: id
            });
        } catch (sockErr) {}

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const markArranged = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Swap.markArranged(id, req.user.id);
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const saveAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Swap.saveAddress(id, req.user.id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const createManagedPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentIntent = await Swap.createManagedPayment(id, req.user.id);
        res.json(paymentIntent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const verifyManagedPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Swap.verifyManagedPayment(id, req.user.id, req.body);

        try {
            const socket = require('../socket');
            const partnerId = parseInt(req.user.id, 10) === parseInt(updated.requester_id, 10) ? updated.owner_id : updated.requester_id;
            socket.sendNotification(partnerId, {
                type: 'SWAP_PAYMENT_CONFIRMED',
                message: 'Partner paid their exchange courier fee.',
                reference_id: id
            });
        } catch (sockErr) {}

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const advanceCourier = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;

        // 1. Retrieve the swap using its ID
        const swap = await Swap.findById(id);

        // 2. Return HTTP 404 if the swap does not exist
        if (!swap) {
            return res.status(404).json({ message: 'Swap request not found' });
        }

        // 3. Verify that the authenticated user is either requester, owner, or ADMIN
        const isRequester = parseInt(swap.requester_id, 10) === parseInt(req.user.id, 10);
        const isOwner = parseInt(swap.owner_id, 10) === parseInt(req.user.id, 10);
        const isAdmin = req.user?.role === 'ADMIN';

        // 4. Return HTTP 403 for unauthorized users
        if (!isRequester && !isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Access denied: You are not authorized to advance this exchange' });
        }

        // 5. Only after authorization succeeds, call Swap.advanceCourierStage()
        const updated = await Swap.advanceCourierStage(id, stage);

        try {
            const socket = require('../socket');
            socket.sendNotification(updated.requester_id, {
                type: 'SWAP_COURIER_UPDATED',
                message: `QUIRO Courier status: ${updated.courier_status}`,
                reference_id: id
            });
            socket.sendNotification(updated.owner_id, {
                type: 'SWAP_COURIER_UPDATED',
                message: `QUIRO Courier status: ${updated.courier_status}`,
                reference_id: id
            });
        } catch (sockErr) {}

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const refundSwap = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const result = await Swap.processSwapRefund(id, req.user.id, reason);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getExchangeConfig = (req, res) => {
    try {
        const config = Swap.getExchangeConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving exchange configuration', error: error.message });
    }
};

module.exports = {
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
    // Extended Workflow
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
};
