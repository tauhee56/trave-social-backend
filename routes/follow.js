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

const uniqStrings = (arr) => Array.from(new Set((arr || []).filter(Boolean).map(v => String(v))));

async function resolveUserIdentifiers(inputId) {
  const raw = String(inputId);
  const User = mongoose.model('User');

  try {
    let user = null;
    if (mongoose.Types.ObjectId.isValid(raw)) {
      user = await User.findById(raw).select('firebaseUid').lean();
    }
    if (!user) {
      user = await User.findOne({ firebaseUid: raw }).select('firebaseUid').lean();
    }

    const canonicalId = user?._id ? String(user._id) : raw;
    const firebaseUid = user?.firebaseUid ? String(user.firebaseUid) : null;
    const candidates = uniqStrings([raw, canonicalId, firebaseUid]);

    return { raw, canonicalId, firebaseUid, candidates };
  } catch {
    return { raw, canonicalId: raw, firebaseUid: null, candidates: uniqStrings([raw]) };
  }
}

// Follow a user (POST /api/follow)
router.post('/', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;

    console.log('[POST /follow] followerId:', followerId, 'followingId:', followingId);

    if (!followerId || !followingId) {
      return res.status(400).json({ success: false, error: 'followerId and followingId required' });
    }

    const follower = await resolveUserIdentifiers(followerId);
    const following = await resolveUserIdentifiers(followingId);

    const followerIdCanonical = follower.canonicalId;
    const followingIdCanonical = following.canonicalId;

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId: { $in: follower.candidates },
      followingId: { $in: following.candidates }
    });
    if (existingFollow) {
      console.log('[POST /follow] Already following');
      return res.json({ success: true, message: 'Already following' });
    }

    // Create follow relationship
    const follow = new Follow({ followerId: followerIdCanonical, followingId: followingIdCanonical });
    await follow.save();

    // Best-effort: create follow notification
    try {
      const db = mongoose.connection.db;
      const User = mongoose.model('User');

      const followerQuery = { $or: [{ firebaseUid: follower.raw }, { uid: follower.raw }] };
      if (mongoose.Types.ObjectId.isValid(followerIdCanonical)) {
        followerQuery.$or.push({ _id: new mongoose.Types.ObjectId(followerIdCanonical) });
      }

      const followerUser = await User.findOne(followerQuery)
        .select('displayName name avatar photoURL profilePicture')
        .lean();

      const senderName = followerUser?.displayName || followerUser?.name || 'Someone';
      const senderAvatar = followerUser?.avatar || followerUser?.photoURL || followerUser?.profilePicture || null;

      await db.collection('notifications').insertOne({
        recipientId: String(followingIdCanonical),
        senderId: String(followerIdCanonical),
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
      { $or: [{ firebaseUid: follower.raw }, { _id: mongoose.Types.ObjectId.isValid(followerIdCanonical) ? new mongoose.Types.ObjectId(followerIdCanonical) : null }] },
      { $inc: { followingCount: 1 } }
    );

    // Increment followers count for following user
    await User.updateOne(
      { $or: [{ firebaseUid: following.raw }, { _id: mongoose.Types.ObjectId.isValid(followingIdCanonical) ? new mongoose.Types.ObjectId(followingIdCanonical) : null }] },
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

    const follower = await resolveUserIdentifiers(followerId);
    const following = await resolveUserIdentifiers(followingId);

    const followerIdCanonical = follower.canonicalId;
    const followingIdCanonical = following.canonicalId;

    // Delete follow relationship
    console.log('[DELETE /follow] Attempting to delete follow relationship...');
    let result = await Follow.deleteOne({ followerId: followerIdCanonical, followingId: followingIdCanonical });
    if (result.deletedCount === 0) {
      result = await Follow.deleteOne({
        followerId: { $in: follower.candidates },
        followingId: { $in: following.candidates }
      });
    }
    console.log('[DELETE /follow] Delete result:', result);

    if (result.deletedCount === 0) {
      console.log('[DELETE /follow] Follow relationship not found');
      return res.json({ success: true, message: 'Not following' });
    }

    // Update follower/following counts in User model
    const User = mongoose.model('User');

    // Decrement following count for follower
    await User.updateOne(
      { $or: [{ firebaseUid: follower.raw }, { _id: mongoose.Types.ObjectId.isValid(followerIdCanonical) ? new mongoose.Types.ObjectId(followerIdCanonical) : null }] },
      { $inc: { followingCount: -1 } }
    );

    // Clamp to prevent negative counts (best-effort)
    await User.updateOne(
      { $or: [{ firebaseUid: follower.raw }, { _id: mongoose.Types.ObjectId.isValid(followerIdCanonical) ? new mongoose.Types.ObjectId(followerIdCanonical) : null }] },
      { $max: { followingCount: 0 } }
    );

    // Decrement followers count for following user
    await User.updateOne(
      { $or: [{ firebaseUid: following.raw }, { _id: mongoose.Types.ObjectId.isValid(followingIdCanonical) ? new mongoose.Types.ObjectId(followingIdCanonical) : null }] },
      { $inc: { followersCount: -1 } }
    );

    // Clamp to prevent negative counts (best-effort)
    await User.updateOne(
      { $or: [{ firebaseUid: following.raw }, { _id: mongoose.Types.ObjectId.isValid(followingIdCanonical) ? new mongoose.Types.ObjectId(followingIdCanonical) : null }] },
      { $max: { followersCount: 0 } }
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

    const follower = await resolveUserIdentifiers(followerId);
    const following = await resolveUserIdentifiers(followingId);

    let follow = await Follow.findOne({ followerId: follower.canonicalId, followingId: following.canonicalId });
    if (!follow) {
      follow = await Follow.findOne({
        followerId: { $in: follower.candidates },
        followingId: { $in: following.candidates }
      });
    }

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

    const targetUser = await resolveUserIdentifiers(userId);

    // Get all followers
    const followers = await Follow.find({ followingId: { $in: targetUser.candidates } });
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
    }).select('firebaseUid displayName name username avatar photoURL profilePicture').lean();

    // Check if current user follows each follower
    let currentUserFollowing = [];
    if (currentUserId) {
      const current = await resolveUserIdentifiers(currentUserId);
      const followingIdCandidates = Array.from(
        new Set(
          users
            .flatMap((u) => [u?._id ? String(u._id) : null, u?.firebaseUid ? String(u.firebaseUid) : null])
            .filter(Boolean)
        )
      );

      currentUserFollowing = await Follow.find({
        followerId: { $in: current.candidates },
        followingId: { $in: followingIdCandidates }
      });
    }

    // Map to user items with follow status
    const userItems = users.map(user => {
      const uid = user._id ? String(user._id) : (user.firebaseUid ? String(user.firebaseUid) : '');
      const idCandidates = [uid, user.firebaseUid ? String(user.firebaseUid) : null].filter(Boolean);
      const isFollowing = currentUserFollowing.some(f => idCandidates.includes(String(f.followingId)));
      const isFollowingYou = true; // They are in followers list, so they follow you

      const displayName = user.displayName || user.name || 'User';
      const resolvedAvatar = user.avatar || user.photoURL || user.profilePicture || '';

      return {
        uid,
        firebaseUid: user.firebaseUid || '',
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

    const targetUser = await resolveUserIdentifiers(userId);

    // Get all following
    const following = await Follow.find({ followerId: { $in: targetUser.candidates } });
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
    }).select('firebaseUid displayName name username avatar photoURL profilePicture').lean();

    // Resolve target user's canonical + firebase ids so follow-back works with legacy mixed ids
    const targetUserIdCandidates = Array.from(
      new Set([
        String(userId),
        targetUser?._id ? String(targetUser._id) : null,
        targetUser?.firebaseUid ? String(targetUser.firebaseUid) : null,
      ].filter(Boolean))
    );

    const followerIdCandidates = Array.from(
      new Set(
        users
          .flatMap((u) => [u?._id ? String(u._id) : null, u?.firebaseUid ? String(u.firebaseUid) : null])
          .filter(Boolean)
      )
    );

    // Check if they follow back (mutual)
    const followsBack = await Follow.find({
      followerId: { $in: followerIdCandidates },
      followingId: { $in: targetUserIdCandidates }
    });

    // Map to user items with follow status
    const userItems = users.map(user => {
      const uid = user._id ? String(user._id) : (user.firebaseUid ? String(user.firebaseUid) : '');
      const idCandidates = [uid, user.firebaseUid ? String(user.firebaseUid) : null].filter(Boolean);
      const isFollowingYou = followsBack.some(f => idCandidates.includes(String(f.followerId)));

      const displayName = user.displayName || user.name || 'User';
      const resolvedAvatar = user.avatar || user.photoURL || user.profilePicture || '';

      return {
        uid,
        firebaseUid: user.firebaseUid || '',
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

    const from = await resolveUserIdentifiers(fromUserId);
    const to = await resolveUserIdentifiers(toUserId);

    // Check if request already exists
    const existingRequest = await FollowRequest.findOne({
      fromUserId: { $in: from.candidates },
      toUserId: { $in: to.candidates },
      status: 'pending'
    });
    if (existingRequest) {
      return res.json({ success: false, error: 'Follow request already sent', alreadyRequested: true });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId: { $in: from.candidates },
      followingId: { $in: to.candidates }
    });
    if (existingFollow) {
      return res.json({ success: false, error: 'Already following this user', alreadyFollowing: true });
    }

    const followRequest = new FollowRequest({ fromUserId: from.canonicalId, toUserId: to.canonicalId });
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
    const from = await resolveUserIdentifiers(followRequest.fromUserId);
    const to = await resolveUserIdentifiers(followRequest.toUserId);

    const follow = new Follow({
      followerId: from.canonicalId,
      followingId: to.canonicalId
    });
    await follow.save();

    // Update follower/following counts in User model
    const User = mongoose.model('User');

    // Increment following count for requester
    await User.updateOne(
      { $or: [{ firebaseUid: from.raw }, { _id: mongoose.Types.ObjectId.isValid(from.canonicalId) ? new mongoose.Types.ObjectId(from.canonicalId) : null }] },
      { $inc: { followingCount: 1 } }
    );

    // Increment followers count for private user
    await User.updateOne(
      { $or: [{ firebaseUid: to.raw }, { _id: mongoose.Types.ObjectId.isValid(to.canonicalId) ? new mongoose.Types.ObjectId(to.canonicalId) : null }] },
      { $inc: { followersCount: 1 } }
    );

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
