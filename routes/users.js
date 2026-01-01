const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Use centralized User model (already loaded by auth.js or server initialization)
let User;
try {
  User = mongoose.model('User');
} catch {
  // Fallback with same schema as auth.js for consistency
  const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, sparse: true },
    email: { type: String, unique: true, required: true },
    displayName: String,
    avatar: String,
    bio: String,
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  User = mongoose.model('User', userSchema);
}

// GET /api/users/:userId - Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let user = null;
    
    // Try MongoDB ObjectId first
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    // If not found, try searching by firebaseUid
    if (!user) {
      user = await User.findOne({ firebaseUid: userId });
    }
    
    // If user exists in database, return it
    if (user) {
      res.json({ success: true, data: user });
    } else {
      // Return placeholder if not in database
      res.json({
        success: true,
        data: {
          _id: userId,
          firebaseUid: userId,
          email: '',
          username: 'user_' + userId.slice(-6),
          displayName: 'User',
          avatar: null,
          bio: '',
          followers: 0,
          following: 0,
          posts: 0,
          isPrivate: false
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:userId - Update user profile
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findByIdAndUpdate(userId, updates, { new: true, upsert: true });
      res.json({ success: true, data: user });
    } else {
      res.json({ success: true, data: { _id: userId, ...updates } });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:userId/posts - Get user's posts (with privacy check)
router.get('/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query; // Current user ID if available
    
    // Get posts collection
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');
    
    // Find posts by userId (could be MongoDB ObjectId or Firebase UID)
    const posts = await postsCollection
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Check if user is private
    const targetUser = await usersCollection.findOne({
      $or: [
        { firebaseUid: userId },
        { uid: userId },
        { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
      ]
    });
    
    // If user is private, check if requester has permission to see posts
    if (targetUser?.isPrivate) {
      // Allow if: requester is the user themselves, or requester follows this user
      if (requesterUserId && requesterUserId !== userId) {
        // Check if requester follows this user
        const follows = await followsCollection.findOne({
          followerId: requesterUserId,
          followingId: userId
        });
        
        if (!follows) {
          // Requester doesn't follow and isn't the user, deny access
          return res.json({ success: true, data: [] });
        }
      } else if (!requesterUserId) {
        // No requester ID provided and user is private, deny access
        return res.json({ success: true, data: [] });
      }
    }
    
    res.json({ success: true, data: posts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// GET /api/users/:userId/sections - Get user sections (with privacy check)
router.get('/:userId/sections', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');
    
    // Check if user is private
    const targetUser = await usersCollection.findOne({
      $or: [
        { firebaseUid: userId },
        { uid: userId },
        { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
      ]
    });
    
    // If user is private, check access permission
    if (targetUser?.isPrivate && requesterUserId && requesterUserId !== userId) {
      const follows = await followsCollection.findOne({
        followerId: requesterUserId,
        followingId: userId
      });
      
      if (!follows) {
        return res.json({ success: true, data: [] });
      }
    } else if (targetUser?.isPrivate && !requesterUserId) {
      return res.json({ success: true, data: [] });
    }
    
    const sections = await sectionsCollection
      .find({ userId: userId })
      .sort({ order: 1 })
      .toArray();
    
    res.json({ success: true, data: sections || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// GET /api/users/:userId/highlights - Get user highlights (with privacy check)
router.get('/:userId/highlights', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    const highlightsCollection = db.collection('highlights');
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');
    
    // Check if user is private
    const targetUser = await usersCollection.findOne({
      $or: [
        { firebaseUid: userId },
        { uid: userId },
        { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
      ]
    });
    
    // If user is private, check access permission
    if (targetUser?.isPrivate && requesterUserId && requesterUserId !== userId) {
      const follows = await followsCollection.findOne({
        followerId: requesterUserId,
        followingId: userId
      });
      
      if (!follows) {
        return res.json({ success: true, data: [] });
      }
    } else if (targetUser?.isPrivate && !requesterUserId) {
      return res.json({ success: true, data: [] });
    }
    
    const highlights = await highlightsCollection
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: highlights || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// GET /api/users/:userId/stories - Get user stories (with privacy check)
router.get('/:userId/stories', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    const storiesCollection = db.collection('stories');
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');
    
    // Check if user is private
    const targetUser = await usersCollection.findOne({
      $or: [
        { firebaseUid: userId },
        { uid: userId },
        { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
      ]
    });
    
    // If user is private, check access permission
    if (targetUser?.isPrivate && requesterUserId && requesterUserId !== userId) {
      const follows = await followsCollection.findOne({
        followerId: requesterUserId,
        followingId: userId
      });
      
      if (!follows) {
        return res.json({ success: true, data: [] });
      }
    } else if (targetUser?.isPrivate && !requesterUserId) {
      return res.json({ success: true, data: [] });
    }
    
    const stories = await storiesCollection
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: stories || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// POST /api/users/:userId/follow - Follow user
router.post('/:userId/follow', async (req, res) => {
  try {
    res.json({ success: true, message: 'Followed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:userId/follow - Unfollow user
router.delete('/:userId/follow', async (req, res) => {
  try {
    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/users/:userId/privacy - Update user privacy
router.patch('/:userId/privacy', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isPrivate } = req.body;
    
    console.log('[PATCH /privacy] Received:', { userId, isPrivate });
    
    if (isPrivate === undefined) {
      return res.status(400).json({ success: false, error: 'isPrivate is required' });
    }
    
    const query = { $or: [{ firebaseUid: userId }, { uid: userId }] };
    
    if (mongoose.Types.ObjectId.isValid(userId)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(userId) });
    }
    
    console.log('[PATCH /privacy] Query:', query);
    
    const user = await User.findOneAndUpdate(
      query,
      { $set: { isPrivate, updatedAt: new Date() } },
      { new: true }
    );
    
    console.log('[PATCH /privacy] Result:', { userFound: !!user, isPrivate: user?.isPrivate });
    
    if (!user) {
      console.error('[PATCH /privacy] User not found with query:', query);
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    console.log('[PATCH /privacy] ✅ Privacy updated for user:', userId);
    return res.json({ success: true, data: { isPrivate: user.isPrivate } });
  } catch (err) {
    console.error('[PATCH] /:userId/privacy error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users/:userId/sections - Create a new section
router.post('/:userId/sections', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, postIds, coverImage } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Section name required' });
    }

    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');

    // Get max order for this user
    const lastSection = await sectionsCollection
      .findOne({ userId }, { sort: { order: -1 } });
    const nextOrder = (lastSection?.order || 0) + 1;

    const sectionData = {
      userId,
      name,
      postIds: postIds || [],
      coverImage: coverImage || null,
      order: nextOrder,
      createdAt: new Date()
    };

    const result = await sectionsCollection.insertOne(sectionData);
    sectionData._id = result.insertedId;

    res.status(201).json({ success: true, data: sectionData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
