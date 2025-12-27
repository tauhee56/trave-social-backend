const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  action: { type: String, required: true }, // 'ban_user', 'delete_post', 'approve_post', etc
  targetType: { type: String, required: true }, // 'user', 'post', 'content'
  targetId: { type: String, required: true },
  targetData: mongoose.Schema.Types.Mixed, // original data before action
  reason: String,
  notes: String,
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);
