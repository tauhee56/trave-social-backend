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

// Follow a user (POST /api/follow)
router.post('/', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    const follow = new Follow({ followerId, followingId });
    await follow.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unfollow a user (DELETE /api/follow)
router.delete('/', async (req, res) => {
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

// Follow request model for private accounts
const followRequestSchema = new mongoose.Schema({
  fromUserId: String,
  toUserId: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const FollowRequest = mongoose.models.FollowRequest || mongoose.model('FollowRequest', followRequestSchema);

// Get following of a user
router.get('/users/:userId/following', async (req, res) => {
  try {
    const following = await Follow.find({ followerId: req.params.userId });
    res.json({ success: true, data: following });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send follow request to private account (POST /api/follow/request)
router.post('/request', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;
    console.log('[Follow Request] fromUserId:', fromUserId, 'toUserId:', toUserId);

    // Check if request already exists
    const existingRequest = await FollowRequest.findOne({ fromUserId, toUserId, status: 'pending' });
    if (existingRequest) {
      return res.json({ success: false, error: 'Follow request already sent' });
    }

    const followRequest = new FollowRequest({ fromUserId, toUserId });
    await followRequest.save();
    console.log('[Follow Request] Created:', followRequest);
    res.json({ success: true, data: followRequest });
  } catch (err) {
    console.error('[Follow Request] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reject follow request (DELETE /api/follow/request/:requesterId)
router.delete('/request/:requesterId', async (req, res) => {
  try {
    const { requesterId } = req.params;
    const { userId } = req.body;
    console.log('[Reject Follow Request] requesterId:', requesterId, 'userId:', userId);

    await FollowRequest.deleteOne({ fromUserId: requesterId, toUserId: userId });
    console.log('[Reject Follow Request] Deleted');
    res.json({ success: true });
  } catch (err) {
    console.error('[Reject Follow Request] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
