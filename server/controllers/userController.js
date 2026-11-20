const User = require('../models/User');
const bcrypt = require('bcryptjs');

const getPublicProfile = async (req, res) => {
    try {
        const user = await User.getPublicProfile(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const stats = await User.getDashboardStats(req.user.id);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        await User.updateProfile(req.user.id, req.body);
        const updatedUser = await User.findById(req.user.id);
        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findByEmail(req.user.email);
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Current password incorrect' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await User.updatePassword(req.user.id, hashedPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error changing password', error: error.message });
    }
};

const logActivity = async (req, res) => {
    try {
        const { activity_type, reference_id, search_query } = req.body;
        const { pool } = require('../config/db');
        await pool.execute(
            'INSERT INTO user_activity (user_id, activity_type, reference_id, search_query) VALUES (?, ?, ?, ?)',
            [req.user.id, activity_type, reference_id || null, search_query || null]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error logging activity', error: error.message });
    }
};

module.exports = {
    getPublicProfile,
    getDashboardStats,
    updateProfile,
    changePassword,
    logActivity
};
