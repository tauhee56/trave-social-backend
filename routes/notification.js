const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Notification model (define properly in models/Notification.js in real use)
const Notification = mongoose.model('Notification', new mongoose.Schema({
  recipientId: String,
  senderId: String,
  type: String,
  message: String,
  senderName: String,
  senderAvatar: String,
  createdAt: { type: Date, default: Date.now }
}));

// Add a notification
router.post('/notifications', async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    res.json({ success: true, id: notification._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get notifications for a user
router.get('/users/:userId/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a notification
router.delete('/notifications/:notificationId', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.notificationId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
