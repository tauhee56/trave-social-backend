const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { sendPushNotification, sendEventNotification } = require('../services/pushNotificationService');

// Notification model (define properly in models/Notification.js in real use)
const Notification = mongoose.model('Notification', new mongoose.Schema({
  recipientId: String,
  senderId: String,
  type: String,
  message: String,
  senderName: String,
  senderAvatar: String,
  read: { type: Boolean, default: false },
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

// Mark notification as read
router.put('/notifications/:notificationId/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.notificationId, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save push token for user
router.put('/users/:userId/push-token', async (req, res) => {
  try {
    const { pushToken } = req.body;
    const User = mongoose.model('User');
    
    await User.findOneAndUpdate(
      { userId: req.params.userId },
      { 
        pushToken: pushToken,
        pushTokenUpdatedAt: new Date()
      },
      { upsert: true }
    );
    
    console.log(`✅ Saved push token for user ${req.params.userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving push token:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send push notification directly
router.post('/notifications/send-push', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    
    if (!userId || !title || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, title, and body are required' 
      });
    }
    
    // Get user's push token
    const User = mongoose.model('User');
    const user = await User.findOne({ userId: userId });
    
    if (!user || !user.pushToken) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found or no push token registered' 
      });
    }
    
    const result = await sendPushNotification(user.pushToken, title, body, data);
    res.json(result);
  } catch (err) {
    console.error('Error sending push notification:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger notification for events (like, comment, follow, etc.)
router.post('/notifications/trigger', async (req, res) => {
  try {
    const { type, recipientId, senderId, data = {} } = req.body;
    
    if (!type || !recipientId || !senderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'type, recipientId, and senderId are required' 
      });
    }
    
    const User = mongoose.model('User');
    
    // Get recipient and sender info
    const [recipient, sender] = await Promise.all([
      User.findOne({ userId: recipientId }),
      User.findOne({ userId: senderId })
    ]);
    
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }
    
    if (!sender) {
      return res.status(404).json({ success: false, error: 'Sender not found' });
    }
    
    const senderName = sender.displayName || sender.name || 'Someone';
    const senderAvatar = sender.avatar || sender.photoURL || sender.profilePicture;
    
    // Save notification to database
    let message;
    switch (type) {
      case 'like':
        message = `${senderName} liked your post`;
        break;
      case 'comment':
        message = `${senderName} commented: ${data.comment || ''}`.substring(0, 100);
        break;
      case 'follow':
        message = `${senderName} started following you`;
        break;
      case 'message':
        message = data.message || 'New message';
        break;
      case 'story':
        message = `${senderName} posted a new story`;
        break;
      case 'live':
        message = `${senderName} is live!`;
        break;
      case 'mention':
        message = `${senderName} mentioned you`;
        break;
      default:
        message = `${senderName} interacted with you`;
    }
    
    const notification = new Notification({
      recipientId,
      senderId,
      type,
      message,
      senderName,
      senderAvatar,
    });
    await notification.save();
    
    // Send push notification if user has token
    let pushResult = { success: false, message: 'No push token' };
    if (recipient.pushToken) {
      pushResult = await sendEventNotification({
        type,
        recipientToken: recipient.pushToken,
        senderName,
        data
      });
    }
    
    res.json({ 
      success: true, 
      notificationId: notification._id,
      pushSent: pushResult.success,
      pushResult
    });
  } catch (err) {
    console.error('Error triggering notification:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
