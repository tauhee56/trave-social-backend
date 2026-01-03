const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Message model (define properly in models/Message.js in real use)
const messageSchema = new mongoose.Schema({
  conversationId: String,
  senderId: String,
  senderName: String,
  senderAvatar: String,
  text: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
  reactions: Object,
  editedAt: Date
});

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// Get all messages for a conversation with populated user data
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });

    // Populate user data for each message
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const enrichedMessages = await Promise.all(messages.map(async (message) => {
      const messageObj = message.toObject ? message.toObject() : message;

      // Find sender data
      const sender = await usersCollection.findOne({
        $or: [
          { firebaseUid: message.senderId },
          { uid: message.senderId },
          { _id: mongoose.Types.ObjectId.isValid(message.senderId) ? new mongoose.Types.ObjectId(message.senderId) : null }
        ]
      });

      return {
        ...messageObj,
        senderName: sender?.displayName || sender?.name || messageObj.senderName || 'User',
        senderAvatar: sender?.avatar || sender?.photoURL || messageObj.senderAvatar || null
      };
    }));

    res.json({ success: true, data: enrichedMessages });
  } catch (err) {
    console.error('[GET /messages] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit a message
router.patch('/conversations/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    if (message.senderId !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });
    message.text = text;
    message.editedAt = new Date();
    await message.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a message
router.delete('/conversations/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const { userId } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    if (message.senderId !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });
    await message.remove();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TODO: Add endpoints for reactions and real-time features as needed

module.exports = router;
