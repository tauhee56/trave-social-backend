const express = require('express');
const router = express.Router();


const mongoose = require('mongoose');
let LiveStream;
try {
  LiveStream = mongoose.model('LiveStream');
} catch {
  LiveStream = mongoose.model('LiveStream', new mongoose.Schema({
    userId: String,
    title: String,
    isActive: Boolean,
    createdAt: { type: Date, default: Date.now }
  }));
}


// GET /api/live-streams - Return all active live streams
router.get('/', async (req, res) => {
  try {
    const streams = await LiveStream.find({ isActive: true });
    res.json({ success: true, data: streams || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// POST /api/live-streams - Start a new live stream
router.post('/', async (req, res) => {
  try {
    const { userId, title } = req.body;
    const stream = new LiveStream({ userId, title, isActive: true });
    await stream.save();
    res.json({ success: true, data: stream });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/live-streams/:id/end - End a live stream
router.patch('/:id/end', async (req, res) => {
  try {
    const stream = await LiveStream.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!stream) return res.status(404).json({ success: false, error: 'Stream not found' });
    res.json({ success: true, data: stream });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
