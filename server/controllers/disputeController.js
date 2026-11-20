const TrustSafetyService = require('../services/trustSafetyService');

/**
 * ==========================================
 * REPORT CONTROLLERS
 * ==========================================
 */
const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason, description, evidenceUrl, priority } = req.body;
        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ message: 'Target type, target ID, and reason are required.' });
        }

        const report = await TrustSafetyService.createReport({
            reporterId: req.user.id,
            targetType,
            targetId: parseInt(targetId, 10),
            reason,
            description,
            evidenceUrl,
            priority
        });

        res.status(201).json({ message: 'Report submitted successfully. Our Trust & Safety team will review it.', report });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getReports = async (req, res) => {
    try {
        const { status, priority, targetType, limit = 50, offset = 0 } = req.query;
        const reports = await TrustSafetyService.getReports({ status, priority, targetType, limit, offset });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reports', error: error.message });
    }
};

const resolveReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolutionNotes, actionOnTarget } = req.body;
        const result = await TrustSafetyService.resolveReport(parseInt(id, 10), req.user.id, {
            status,
            resolutionNotes,
            actionOnTarget
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * ==========================================
 * DISPUTE CONTROLLERS
 * ==========================================
 */
const createDispute = async (req, res) => {
    try {
        const { entityType, entityId, reason, description, evidence } = req.body;
        if (!entityType || !entityId || !reason || !description) {
            return res.status(400).json({ message: 'Entity type, entity ID, reason, and detailed description are required.' });
        }

        const dispute = await TrustSafetyService.createDispute({
            initiatorId: req.user.id,
            entityType,
            entityId: parseInt(entityId, 10),
            reason,
            description,
            evidence
        });

        res.status(201).json({ message: 'Dispute case opened successfully.', dispute });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMyDisputes = async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        const disputes = await TrustSafetyService.getUserDisputes(req.user.id, { status, limit, offset });
        res.json(disputes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user disputes', error: error.message });
    }
};

const getDisputeById = async (req, res) => {
    try {
        const { id } = req.params;
        const disputeWorkspace = await TrustSafetyService.getDisputeById(id, req.user.id, req.user.role);
        if (!disputeWorkspace) {
            return res.status(404).json({ message: 'Dispute not found.' });
        }
        res.json(disputeWorkspace);
    } catch (error) {
        if (error.message.startsWith('Forbidden')) {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const addDisputeMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, attachments, isInternal } = req.body;
        if (!message || message.trim() === '') {
            return res.status(400).json({ message: 'Message content is required.' });
        }

        const msgResult = await TrustSafetyService.addDisputeMessage(
            parseInt(id, 10),
            req.user.id,
            req.user.role,
            { message, attachments, isInternal: req.user.role === 'ADMIN' ? isInternal : false }
        );

        res.status(201).json(msgResult);
    } catch (error) {
        if (error.message.startsWith('Forbidden')) {
            return res.status(403).json({ message: error.message });
        }
        res.status(400).json({ message: error.message });
    }
};

const addDisputeEvidence = async (req, res) => {
    try {
        const { id } = req.params;
        const { fileUrl, fileType, caption } = req.body;
        if (!fileUrl) {
            return res.status(400).json({ message: 'File URL is required.' });
        }

        const evResult = await TrustSafetyService.addDisputeEvidence(
            parseInt(id, 10),
            req.user.id,
            req.user.role,
            { fileUrl, fileType, caption }
        );

        res.status(201).json(evResult);
    } catch (error) {
        if (error.message.startsWith('Forbidden')) {
            return res.status(403).json({ message: error.message });
        }
        res.status(400).json({ message: error.message });
    }
};

const sellerRespond = async (req, res) => {
    try {
        const { id } = req.params;
        const { responseText, acceptReturn, evidenceUrl } = req.body;
        if (!responseText) {
            return res.status(400).json({ message: 'Response explanation is required.' });
        }

        const result = await TrustSafetyService.sellerRespondDispute(
            parseInt(id, 10),
            req.user.id,
            { responseText, acceptReturn, evidenceUrl }
        );

        res.json(result);
    } catch (error) {
        if (error.message.startsWith('Forbidden')) {
            return res.status(403).json({ message: error.message });
        }
        res.status(400).json({ message: error.message });
    }
};

const getSellerTrustScore = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const score = await TrustSafetyService.calculateSellerTrustScore(sellerId);
        if (!score) {
            return res.status(404).json({ message: 'Seller not found.' });
        }
        res.json(score);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ==========================================
 * ADMIN TRUST & SAFETY CONTROLLERS
 * ==========================================
 */
const getAdminDisputes = async (req, res) => {
    try {
        const { status, priority, entityType, search, sortBy, limit = 50, offset = 0 } = req.query;
        const disputes = await TrustSafetyService.getAdminDisputes({
            status,
            priority,
            entityType,
            search,
            sortBy,
            limit,
            offset
        });
        res.json(disputes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateDisputeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, assignedAdminId, resolutionType, resolutionNotes, refundAmount } = req.body;

        const result = await TrustSafetyService.updateDisputeStatus(parseInt(id, 10), req.user.id, {
            status,
            priority,
            assignedAdminId,
            resolutionType,
            resolutionNotes,
            refundAmount: refundAmount ? parseFloat(refundAmount) : 0
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getTrustSafetyStats = async (req, res) => {
    try {
        const stats = await TrustSafetyService.getTrustAndSafetyStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSellerRisk = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const flags = await TrustSafetyService.getSellerRiskFlags(sellerId);
        const trustScore = await TrustSafetyService.calculateSellerTrustScore(sellerId);
        res.json({ trustScore, riskFlags: flags });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createReport,
    getReports,
    resolveReport,
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage,
    addDisputeEvidence,
    sellerRespond,
    getSellerTrustScore,
    getAdminDisputes,
    updateDisputeStatus,
    getTrustSafetyStats,
    getSellerRisk
};
