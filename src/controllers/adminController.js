const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const { logAdminAction } = require('../middleware/adminAuth');

// GET /api/admin/users - List all users with pagination & filters
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { uid: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (status) filter.status = status;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });

    res.json({ success: true, data: users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/users/:uid - Get single user details
exports.getUserDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/users/:uid/ban - Ban user
exports.banUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const { reason = '', duration = 'permanent' } = req.body;

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.isBanned = true;
    user.status = 'banned';
    user.banReason = reason;
    user.bannedAt = new Date();
    await user.save();

    await logAdminAction(req.admin.uid, 'ban_user', 'user', uid, reason);

    res.json({ success: true, message: `User ${uid} has been banned.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/users/:uid/unban - Unban user
exports.unbanUser = async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.isBanned = false;
    user.status = 'active';
    user.banReason = null;
    user.bannedAt = null;
    await user.save();

    await logAdminAction(req.admin.uid, 'unban_user', 'user', uid);

    res.json({ success: true, message: `User ${uid} has been unbanned.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/users/:uid/role - Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await logAdminAction(req.admin.uid, 'update_role', 'user', uid, `${oldRole} -> ${role}`);

    res.json({ success: true, message: `User role updated to ${role}.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/admin/users/:uid - Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Delete user's posts first
    // TODO: Add post deletion logic

    await User.deleteOne({ uid });
    await logAdminAction(req.admin.uid, 'delete_user', 'user', uid);

    res.json({ success: true, message: `User ${uid} has been deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/analytics - Dashboard analytics
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const bannedUsers = await User.countDocuments({ status: 'banned' });
    const totalPosts = await Post.countDocuments();
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });

    // User growth (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsersLast30Days = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        bannedUsers,
        totalPosts,
        totalReports,
        pendingReports,
        newUsersLast30Days
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/logs - Get admin action logs
exports.getAdminLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, adminId = '', action = '' } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (adminId) filter.adminId = adminId;
    if (action) filter.action = action;

    const total = await AdminLog.countDocuments(filter);
    const logs = await AdminLog.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });

    res.json({ success: true, data: logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
