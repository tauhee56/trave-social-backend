const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const notificationController = require('../controllers/notificationController');

// Create notification (POST /api/notifications)
router.post('/', notificationController.createNotification);

// Get notifications for user (GET /api/notifications/:userId)
router.get('/:userId', notificationController.getUserNotifications);

// Mark notification as read (POST /api/notifications/:notificationId/read)
router.post('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const objectId = mongoose.Types.ObjectId.isValid(notificationId) 
      ? new mongoose.Types.ObjectId(notificationId) 
      : notificationId;
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');
    
    await notificationsCollection.updateOne(
      { _id: objectId },
      { $set: { read: true, readAt: new Date() } }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark all notifications as read for user
router.post('/user/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');
    
    await notificationsCollection.updateMany(
      { userId, read: { $ne: true } },
      { $set: { read: true, readAt: new Date() } }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const objectId = mongoose.Types.ObjectId.isValid(notificationId) 
      ? new mongoose.Types.ObjectId(notificationId) 
      : notificationId;
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');
    
    await notificationsCollection.deleteOne({ _id: objectId });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
