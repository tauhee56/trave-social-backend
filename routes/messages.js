const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Message model (define properly in models/Message.js in real use)
const Message = mongoose.model('Message', new mongoose.Schema({
  conversationId: String,
  senderId: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
  reactions: Object
}));

// Get all messages for a conversation
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (err) {
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
