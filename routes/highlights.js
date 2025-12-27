const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Highlight model (define properly in models/Highlight.js in real use)
const Highlight = mongoose.model('Highlight', new mongoose.Schema({
  userId: String,
  title: String,
  items: [Object],
  createdAt: { type: Date, default: Date.now }
}));

// Add a highlight
router.post('/highlights', async (req, res) => {
  try {
    const { userId, title, items } = req.body;
    const highlight = new Highlight({ userId, title, items });
    await highlight.save();
    res.json({ success: true, id: highlight._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all highlights for a user
router.get('/users/:userId/highlights', async (req, res) => {
  try {
    const highlights = await Highlight.find({ userId: req.params.userId });
    res.json({ success: true, data: highlights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/highlights - Get highlights (optionally filtered by userId)
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    let highlights = [];
    if (userId) {
      highlights = await Highlight.find({ userId });
    } else {
      highlights = await Highlight.find();
    }
    res.json({ success: true, data: highlights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit a highlight
router.patch('/highlights/:highlightId', async (req, res) => {
  try {
    const { title, items } = req.body;
    const highlight = await Highlight.findById(req.params.highlightId);
    if (!highlight) return res.status(404).json({ success: false, error: 'Highlight not found' });
    if (title) highlight.title = title;
    if (items) highlight.items = items;
    await highlight.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a highlight
router.delete('/highlights/:highlightId', async (req, res) => {
  try {
    await Highlight.findByIdAndDelete(req.params.highlightId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
