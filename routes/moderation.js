const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('🚫 Loading moderation routes (block/report)...');

// Block schema
const blockSchema = new mongoose.Schema({
  blockerId: { type: String, required: true },
  blockedId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Report schema
const reportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reportedId: { type: String, required: true },
  reportedType: { type: String, enum: ['user', 'post', 'comment'], default: 'user' },
  reason: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Block = mongoose.models.Block || mongoose.model('Block', blockSchema);
const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

// ============= BLOCK ROUTES =============

// Block a user
router.post('/users/:userId/block', async (req, res) => {
  try {
    const { userId } = req.params;
    const { blockedId } = req.body;
    
    if (!blockedId) {
      return res.status(400).json({ success: false, error: 'blockedId required' });
    }
    
    // Check if already blocked
    const existing = await Block.findOne({ blockerId: userId, blockedId });
    if (existing) {
      return res.json({ success: true, message: 'Already blocked' });
    }
    
    const block = new Block({ blockerId: userId, blockedId });
    await block.save();
    
    res.json({ success: true, data: block });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unblock a user
router.delete('/users/:userId/block/:blockedId', async (req, res) => {
  try {
    const { userId, blockedId } = req.params;
    await Block.deleteOne({ blockerId: userId, blockedId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get blocked users for user
router.get('/users/:userId/blocked', async (req, res) => {
  try {
    const { userId } = req.params;
    const blocks = await Block.find({ blockerId: userId });
    const blockedIds = blocks.map(b => b.blockedId);
    res.json({ success: true, data: blockedIds });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check if user is blocked
router.get('/users/:userId/block/:targetId', async (req, res) => {
  try {
    const { userId, targetId } = req.params;
    const block = await Block.findOne({ blockerId: userId, blockedId: targetId });
    res.json({ success: true, isBlocked: !!block });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============= REPORT ROUTES =============

// Report a user/post/comment
router.post('/reports', async (req, res) => {
  try {
    const { reporterId, reportedId, reportedType, reason, description } = req.body;
    
    if (!reporterId || !reportedId || !reason) {
      return res.status(400).json({ success: false, error: 'reporterId, reportedId, and reason required' });
    }
    
    const report = new Report({ reporterId, reportedId, reportedType, reason, description });
    await report.save();
    
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get reports for admin
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
