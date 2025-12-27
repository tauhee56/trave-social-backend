const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: { type: String, required: true },
  senderId: String,
  senderName: String,
  senderAvatar: String,
  type: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  postId: String,
  commentId: String
});

module.exports = mongoose.model('Notification', NotificationSchema);
