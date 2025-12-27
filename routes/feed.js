const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('📰 Loading feed route...');

// Get personalized feed for user
router.get('/', async (req, res) => {
  try {
    const { userId, limit = 20, offset = 0 } = req.query;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const followsCollection = db.collection('follows');
    
    let followingIds = [];
    
    // Get users that current user follows
    if (userId) {
      const follows = await followsCollection.find({ followerId: userId }).toArray();
      followingIds = follows.map(f => f.followingId);
      followingIds.push(userId); // Include own posts
    }
    
    // Build query
    let query = {};
    if (followingIds.length > 0) {
      query.userId = { $in: followingIds };
    }
    
    // Get posts
    const posts = await postsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ success: true, data: posts, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [], posts: [] });
  }
});

module.exports = router;
