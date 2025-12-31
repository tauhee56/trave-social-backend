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
    const usersCollection = db.collection('users');
    
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
    let posts = await postsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit) * 2) // Get extra posts to account for filtering
      .toArray();
    
    // Filter out posts from private users that requester doesn't follow
    if (userId) {
      posts = await Promise.all(posts.map(async (post) => {
        // Check if post author is private
        const postAuthor = await usersCollection.findOne({ 
          $or: [
            { firebaseUid: post.userId },
            { uid: post.userId },
            { _id: mongoose.Types.ObjectId.isValid(post.userId) ? new mongoose.Types.ObjectId(post.userId) : null }
          ]
        });
        
        // If author is private and not the current user and current user doesn't follow them, skip
        if (postAuthor?.isPrivate && post.userId !== userId && !followingIds.includes(post.userId)) {
          return null;
        }
        
        return post;
      }));
      
      // Remove null values
      posts = posts.filter(p => p !== null);
    }
    
    // Limit to requested count after filtering
    posts = posts.slice(0, parseInt(limit));
    
    res.json({ success: true, data: posts, posts });
  } catch (err) {
    console.error('[Feed] Error:', err.message);
    res.status(500).json({ success: false, error: err.message, data: [], posts: [] });
  }
});

module.exports = router;
