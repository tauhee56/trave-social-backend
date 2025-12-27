const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reportedUserId: { type: String, required: true },
  reportedBy: { type: String, required: true },
  postId: String,
  reason: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['pending', 'investigating', 'resolved', 'dismissed'], default: 'pending' },
  action: String, // action taken by admin (ban, warn, delete content, etc)
  actionTakenBy: String, // admin uid who took action
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  notes: String
});

module.exports = mongoose.model('Report', ReportSchema);
