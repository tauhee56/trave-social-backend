const mongoose = require('mongoose');

const LiveStreamSchema = new mongoose.Schema({
  userId: String,
  title: String,
  isActive: Boolean,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.LiveStream || mongoose.model('LiveStream', LiveStreamSchema);
