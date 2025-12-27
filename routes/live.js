const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// LiveStream model (define properly in models/LiveStream.js in real use)
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

// GET /api/live-streams/active - Get all active live streams
router.get('/active', async (req, res) => {
  try {
    const streams = await LiveStream.find({ isActive: true });
    res.json({ success: true, streams: streams || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, streams: [] });
  }
});

// GET /api/live-streams - Get all active streams (alias)
router.get('/', async (req, res) => {
  try {
    const streams = await LiveStream.find({ isActive: true });
    res.json({ success: true, streams: streams || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, streams: [] });
  }
});

// POST /api/live-streams - Start a live stream
router.post('/', async (req, res) => {
  try {
    const { userId, title } = req.body;
    const stream = new LiveStream({ userId, title, isActive: true });
    await stream.save();
    res.json({ success: true, id: stream._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/live-streams/:streamId/end - End a live stream
router.patch('/:streamId/end', async (req, res) => {
  try {
    const stream = await LiveStream.findById(req.params.streamId);
    if (!stream) return res.status(404).json({ success: false, error: 'Stream not found' });
    stream.isActive = false;
    await stream.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
