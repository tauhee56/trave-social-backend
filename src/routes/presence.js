const express = require('express');
const router = express.Router();

// In-memory presence store (for demo only)
const presence = {};

router.post('/online', (req, res) => {
  const { userId, conversationId } = req.body;
  presence[userId] = { isOnline: true, lastSeen: new Date(), conversationId };
  res.json({ success: true });
});

router.post('/offline', (req, res) => {
  const { userId } = req.body;
  if (presence[userId]) {
    presence[userId].isOnline = false;
    presence[userId].lastSeen = new Date();
  }
  res.json({ success: true });
});

router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  res.json(presence[userId] || { isOnline: false, lastSeen: null });
});

module.exports = router;
