const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Section model
const Section = mongoose.model('Section', new mongoose.Schema({
  userId: String,
  name: String,
  order: Number,
  createdAt: { type: Date, default: Date.now }
}));

// Get user sections
router.get('/users/:userId/sections', async (req, res) => {
  try {
    const sections = await Section.find({ userId: req.params.userId }).sort({ order: 1 });
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sections - Get sections (optionally filtered by userId)
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    let sections = [];
    if (userId) {
      sections = await Section.find({ userId }).sort({ order: 1 });
    } else {
      sections = await Section.find().sort({ order: 1 });
    }
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update section order
router.patch('/users/:userId/sections-order', async (req, res) => {
  try {
    const { sections } = req.body;
    for (let i = 0; i < sections.length; i++) {
      await Section.updateOne(
        { _id: sections[i]._id },
        { order: i }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
