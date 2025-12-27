const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('👥 Loading follow routes...');

// Follow model with proper check
const followSchema = new mongoose.Schema({
  followerId: String,
  followingId: String,
  createdAt: { type: Date, default: Date.now }
});

const Follow = mongoose.models.Follow || mongoose.model('Follow', followSchema);

// Follow a user
router.post('/follow', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    const follow = new Follow({ followerId, followingId });
    await follow.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unfollow a user
router.delete('/follow', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    await Follow.deleteOne({ followerId, followingId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get followers of a user
router.get('/users/:userId/followers', async (req, res) => {
  try {
    const followers = await Follow.find({ followingId: req.params.userId });
    res.json({ success: true, data: followers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get following of a user
router.get('/users/:userId/following', async (req, res) => {
  try {
    const following = await Follow.find({ followerId: req.params.userId });
    res.json({ success: true, data: following });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
