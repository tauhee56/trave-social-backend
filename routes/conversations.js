const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('📨 Loading conversations route...');

// Conversation model (check if already exists)
const conversationSchema = new mongoose.Schema({
  participants: [String],
  lastMessage: String,
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
console.log('📨 Conversation model loaded');

// Get conversations for user (supports both query param and route param)
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId query parameter required' });
    }
    const conversations = await Conversation.find({ participants: userId });
    res.json({ success: true, data: conversations || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or create conversation
router.post('/get-or-create', async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;
    let conversation = await Conversation.findOne({
      participants: { $all: [userId1, userId2] }
    });
    if (!conversation) {
      conversation = new Conversation({ participants: [userId1, userId2] });
      await conversation.save();
    }
    res.json({ success: true, id: conversation._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get conversations for user (route param version)
router.get('/users/:userId', async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.params.userId });
    res.json({ success: true, data: conversations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
