const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin, logAdminAction } = require('../middleware/adminAuth');

// All routes protected with admin middleware
router.use(isAdmin);

// User Management
router.get('/users', adminController.getAllUsers);
router.get('/users/:uid', adminController.getUserDetails);
router.post('/users/:uid/ban', adminController.banUser);
router.post('/users/:uid/unban', adminController.unbanUser);
router.post('/users/:uid/role', adminController.updateUserRole);
router.delete('/users/:uid', adminController.deleteUser);

// Analytics
router.get('/analytics/dashboard', adminController.getDashboardAnalytics);

// Logs
router.get('/logs', adminController.getAdminLogs);

module.exports = router;
