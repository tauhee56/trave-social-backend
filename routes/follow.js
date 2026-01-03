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

    if (!fromUserId || !toUserId) {
      return res.status(400).json({ success: false, error: 'fromUserId and toUserId required' });
    }

    // Check if request already exists
    const existingRequest = await FollowRequest.findOne({ fromUserId, toUserId, status: 'pending' });
    if (existingRequest) {
      return res.json({ success: false, error: 'Follow request already sent', alreadyRequested: true });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({ followerId: fromUserId, followingId: toUserId });
    if (existingFollow) {
      return res.json({ success: false, error: 'Already following this user', alreadyFollowing: true });
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

// Accept follow request (POST /api/follow/request/:requestId/accept)
router.post('/request/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log('[Accept Follow Request] requestId:', requestId);

    const followRequest = await FollowRequest.findById(requestId);
    if (!followRequest) {
      return res.status(404).json({ success: false, error: 'Follow request not found' });
    }

    if (followRequest.status !== 'pending') {
      return res.json({ success: false, error: 'Follow request already processed' });
    }

    // Create follow relationship
    const follow = new Follow({
      followerId: followRequest.fromUserId,
      followingId: followRequest.toUserId
    });
    await follow.save();

    // Update request status
    followRequest.status = 'accepted';
    await followRequest.save();

    console.log('[Accept Follow Request] Accepted and created follow');
    res.json({ success: true, data: follow });
  } catch (err) {
    console.error('[Accept Follow Request] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reject follow request (DELETE /api/follow/request/:requestId)
router.delete('/request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log('[Reject Follow Request] requestId:', requestId);

    const followRequest = await FollowRequest.findById(requestId);
    if (!followRequest) {
      return res.status(404).json({ success: false, error: 'Follow request not found' });
    }

    // Update status to rejected or delete
    followRequest.status = 'rejected';
    await followRequest.save();

    console.log('[Reject Follow Request] Rejected');
    res.json({ success: true });
  } catch (err) {
    console.error('[Reject Follow Request] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get pending follow requests for a user (GET /api/follow/requests/:userId)
router.get('/requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await FollowRequest.find({ toUserId: userId, status: 'pending' });
    console.log('[Get Follow Requests] Found', requests.length, 'pending requests for user:', userId);
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('[Get Follow Requests] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check if follow request exists (GET /api/follow/request/check)
router.get('/request/check', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.query;
    if (!fromUserId || !toUserId) {
      return res.status(400).json({ success: false, error: 'fromUserId and toUserId required' });
    }

    const request = await FollowRequest.findOne({ fromUserId, toUserId, status: 'pending' });
    res.json({ success: true, exists: !!request, data: request });
  } catch (err) {
    console.error('[Check Follow Request] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
