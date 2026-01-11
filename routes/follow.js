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

    console.log('[POST /follow] followerId:', followerId, 'followingId:', followingId);

    if (!followerId || !followingId) {
      return res.status(400).json({ success: false, error: 'followerId and followingId required' });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({ followerId, followingId });
    if (existingFollow) {
      console.log('[POST /follow] Already following');
      return res.json({ success: true, message: 'Already following' });
    }

    // Create follow relationship
    const follow = new Follow({ followerId, followingId });
    await follow.save();

    // Best-effort: create follow notification
    try {
      const db = mongoose.connection.db;
      const User = mongoose.model('User');

      const followerQuery = { $or: [{ firebaseUid: followerId }, { uid: followerId }] };
      if (mongoose.Types.ObjectId.isValid(followerId)) {
        followerQuery.$or.push({ _id: new mongoose.Types.ObjectId(followerId) });
      }

      const followerUser = await User.findOne(followerQuery)
        .select('displayName name avatar photoURL profilePicture')
        .lean();

      const senderName = followerUser?.displayName || followerUser?.name || 'Someone';
      const senderAvatar = followerUser?.avatar || followerUser?.photoURL || followerUser?.profilePicture || null;

      await db.collection('notifications').insertOne({
        recipientId: String(followingId),
        senderId: String(followerId),
        senderName,
        senderAvatar,
        type: 'follow',
        message: 'started following you',
        read: false,
        createdAt: new Date()
      });
    } catch (e) {
      console.warn('[POST /follow] Notification skipped:', e.message);
    }

    // Update follower/following counts in User model
    const User = mongoose.model('User');

    // Increment following count for follower
    await User.updateOne(
      { $or: [{ firebaseUid: followerId }, { _id: mongoose.Types.ObjectId.isValid(followerId) ? new mongoose.Types.ObjectId(followerId) : null }] },
      { $inc: { followingCount: 1 } }
    );

    // Increment followers count for following user
    await User.updateOne(
      { $or: [{ firebaseUid: followingId }, { _id: mongoose.Types.ObjectId.isValid(followingId) ? new mongoose.Types.ObjectId(followingId) : null }] },
      { $inc: { followersCount: 1 } }
    );

    console.log('[POST /follow] Follow relationship created and counts updated');
    res.json({ success: true });
  } catch (err) {
    console.error('[POST /follow] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unfollow a user (DELETE /api/follow)
router.delete('/', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;

    console.log('[DELETE /follow] Request body:', JSON.stringify(req.body));
    console.log('[DELETE /follow] followerId:', followerId, 'followingId:', followingId);

    if (!followerId || !followingId) {
      console.log('[DELETE /follow] Missing parameters - body:', req.body);
      return res.status(400).json({ success: false, error: 'followerId and followingId required' });
    }

    // Delete follow relationship
    console.log('[DELETE /follow] Attempting to delete follow relationship...');
    const result = await Follow.deleteOne({ followerId, followingId });
    console.log('[DELETE /follow] Delete result:', result);

    if (result.deletedCount === 0) {
      console.log('[DELETE /follow] Follow relationship not found');
      return res.json({ success: true, message: 'Not following' });
    }

    // Update follower/following counts in User model
    const User = mongoose.model('User');

    // Decrement following count for follower
    await User.updateOne(
      { $or: [{ firebaseUid: followerId }, { _id: mongoose.Types.ObjectId.isValid(followerId) ? new mongoose.Types.ObjectId(followerId) : null }] },
      { $inc: { followingCount: -1 } }
    );

    // Decrement followers count for following user
    await User.updateOne(
      { $or: [{ firebaseUid: followingId }, { _id: mongoose.Types.ObjectId.isValid(followingId) ? new mongoose.Types.ObjectId(followingId) : null }] },
      { $inc: { followersCount: -1 } }
    );

    console.log('[DELETE /follow] Follow relationship deleted and counts updated');
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /follow] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check if user is following another user (GET /api/follow/status?followerId=X&followingId=Y)
router.get('/status', async (req, res) => {
  try {
    const { followerId, followingId } = req.query;

    if (!followerId || !followingId) {
      return res.status(400).json({ success: false, error: 'followerId and followingId required' });
    }

    const follow = await Follow.findOne({ followerId, followingId });
    res.json({ success: true, isFollowing: !!follow });
  } catch (err) {
    console.error('[GET /follow/status] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get followers of a user with full user details
router.get('/users/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.query.currentUserId; // For checking if current user follows them

    // Get all followers
    const followers = await Follow.find({ followingId: userId });
    const followerIds = followers.map(f => f.followerId);

    if (followerIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get user details for all followers
    const User = mongoose.model('User');
    const users = await User.find({
      $or: [
        { firebaseUid: { $in: followerIds } },
        { _id: { $in: followerIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    }).select('firebaseUid displayName name username avatar photoURL profilePicture');

    // Check if current user follows each follower
    let currentUserFollowing = [];
    if (currentUserId) {
      currentUserFollowing = await Follow.find({
        followerId: currentUserId,
        followingId: { $in: followerIds }
      });
    }

    // Map to user items with follow status
    const userItems = users.map(user => {
      const uid = user.firebaseUid || user._id.toString();
      const isFollowing = currentUserFollowing.some(f => f.followingId === uid);
      const isFollowingYou = true; // They are in followers list, so they follow you

      const displayName = user.displayName || user.name || 'User';
      const resolvedAvatar = user.avatar || user.photoURL || user.profilePicture || '';

      return {
        uid,
        name: displayName,
        username: user.username || '',
        avatar: resolvedAvatar,
        isFollowing,
        isFollowingYou
      };
    });

    res.json({ success: true, data: userItems });
  } catch (err) {
    console.error('[GET /followers] Error:', err.message);
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

// Get following of a user with full user details
router.get('/users/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.query.currentUserId; // For checking mutual follows

    // Get all following
    const following = await Follow.find({ followerId: userId });
    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get user details for all following
    const User = mongoose.model('User');
    const users = await User.find({
      $or: [
        { firebaseUid: { $in: followingIds } },
        { _id: { $in: followingIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    }).select('firebaseUid displayName name username avatar photoURL profilePicture');

    // Check if they follow back (mutual)
    const followsBack = await Follow.find({
      followerId: { $in: followingIds },
      followingId: userId
    });

    // Map to user items with follow status
    const userItems = users.map(user => {
      const uid = user.firebaseUid || user._id.toString();
      const isFollowingYou = followsBack.some(f => f.followerId === uid);

      const displayName = user.displayName || user.name || 'User';
      const resolvedAvatar = user.avatar || user.photoURL || user.profilePicture || '';

      return {
        uid,
        name: displayName,
        username: user.username || '',
        avatar: resolvedAvatar,
        isFollowing: true, // They are in following list
        isFollowingYou
      };
    });

    res.json({ success: true, data: userItems });
  } catch (err) {
    console.error('[GET /following] Error:', err.message);
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

// Get blocked users list (GET /api/follow/users/:userId/blocked)
router.get('/users/:userId/blocked', async (req, res) => {
  try {
    const { userId } = req.params;

    const db = mongoose.connection.db;
    const blocksCollection = db.collection('blocks');

    // Get all blocked users
    const blocks = await blocksCollection.find({
      blockerId: mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId
    }).toArray();

    if (blocks.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const blockedIds = blocks.map(b => b.blockedId.toString());

    // Get user details
    const User = mongoose.model('User');
    const users = await User.find({
      $or: [
        { firebaseUid: { $in: blockedIds } },
        { _id: { $in: blockedIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    }).select('firebaseUid displayName name username avatar photoURL profilePicture');

    const userItems = users.map(user => {
      const displayName = user.displayName || user.name || 'User';
      const resolvedAvatar = user.avatar || user.photoURL || user.profilePicture || '';

      return {
        uid: user.firebaseUid || user._id.toString(),
        name: displayName,
        username: user.username || '',
        avatar: resolvedAvatar,
        isFollowing: false,
        isFollowingYou: false
      };
    });

    res.json({ success: true, data: userItems });
  } catch (err) {
    console.error('[GET /blocked] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get friends (mutual follows) (GET /api/follow/users/:userId/friends)
router.get('/users/:userId/friends', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all following
    const following = await Follow.find({ followerId: userId });
    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get mutual follows (they follow back)
    const mutualFollows = await Follow.find({
      followerId: { $in: followingIds },
      followingId: userId
    });

    const friendIds = mutualFollows.map(f => f.followerId);

    if (friendIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get user details
    const User = mongoose.model('User');
    const users = await User.find({
      $or: [
        { firebaseUid: { $in: friendIds } },
        { _id: { $in: friendIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    }).select('firebaseUid displayName name username avatar photoURL profilePicture');

    const userItems = users.map(user => {
      const displayName = user.displayName || user.name || 'User';
      const resolvedAvatar = user.avatar || user.photoURL || user.profilePicture || '';

      return {
        uid: user.firebaseUid || user._id.toString(),
        name: displayName,
        username: user.username || '',
        avatar: resolvedAvatar,
        isFollowing: true,
        isFollowingYou: true
      };
    });

    res.json({ success: true, data: userItems });
  } catch (err) {
    console.error('[GET /friends] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
