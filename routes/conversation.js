// routes/conversation.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// Get messages for a conversation
router.get('/:id/messages', async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ messages: convo.messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message (add to conversation)
router.post('/:id/messages', async (req, res) => {
  try {
    const { sender, text } = req.body;
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const message = { sender, text };
    convo.messages.push(message);
    await convo.save();
    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
