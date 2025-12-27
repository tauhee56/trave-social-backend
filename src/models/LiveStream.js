const mongoose = require('mongoose');

const LiveStreamSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  // Add more fields as needed (e.g., viewerCount, channelName, etc.)
});

module.exports = mongoose.model('LiveStream', LiveStreamSchema);
