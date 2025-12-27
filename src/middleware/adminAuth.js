const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const AdminLog = require('../models/AdminLog');

// Middleware to check if user is admin
exports.isAdmin = async (req, res, next) => {
  try {
    const { uid } = req.user; // Assuming JWT middleware provides req.user
    const user = await User.findOne({ uid });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin role required.' });
    }
    
    req.admin = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Log admin action
exports.logAdminAction = async (adminId, action, targetType, targetId, reason = '', notes = '') => {
  try {
    await AdminLog.create({
      adminId,
      action,
      targetType,
      targetId,
      reason,
      notes,
      status: 'success'
    });
  } catch (err) {
    console.error('Error logging admin action:', err);
  }
};
