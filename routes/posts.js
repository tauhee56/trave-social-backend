const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const mongoose = require('mongoose');


// GET /api/posts - Get all posts (public posts only, excluding private users unless requester is their follower)
router.get('/', async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');
    
    // Get posts
    let posts = await Post.find().sort({ createdAt: -1 }).limit(Math.min(parseInt(limit) * 2, 100));
    
    // Filter out posts from private users if not their follower
    if (userId) {
      // Get list of users that current user follows
      const follows = await followsCollection.find({ followerId: userId }).toArray();
      const followingIds = follows.map(f => f.followingId);
      
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
      
      posts = posts.filter(p => p !== null).slice(0, parseInt(limit));
    } else {
      // If no userId provided, only show posts from public users
      posts = await Promise.all(posts.map(async (post) => {
        const postAuthor = await usersCollection.findOne({ 
          $or: [
            { firebaseUid: post.userId },
            { uid: post.userId },
            { _id: mongoose.Types.ObjectId.isValid(post.userId) ? new mongoose.Types.ObjectId(post.userId) : null }
          ]
        });
        
        // Skip if author is private
        if (postAuthor?.isPrivate) {
          return null;
        }
        
        return post;
      }));
      
      posts = posts.filter(p => p !== null).slice(0, parseInt(limit));
    }
    
    res.status(200).json({ success: true, data: Array.isArray(posts) ? posts : [] });
  } catch (err) {
    console.error('[GET /posts] Error:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});

// GET /api/posts/feed - Get feed posts
router.get('/feed', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, data: Array.isArray(posts) ? posts : [] });
  } catch (err) {
    res.status(200).json({ success: true, data: [] });
  }
});

// GET /api/posts/:postId - Get a post by ID (with privacy check)
router.get('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    
    // Check privacy of post author
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');
    const { requesterUserId } = req.query;
    
    const postAuthor = await usersCollection.findOne({ 
      $or: [
        { firebaseUid: post.userId },
        { uid: post.userId },
        { _id: mongoose.Types.ObjectId.isValid(post.userId) ? new mongoose.Types.ObjectId(post.userId) : null }
      ]
    });
    
    // If author is private, check requester permission
    if (postAuthor?.isPrivate) {
      // Allow if requester is the post author
      if (post.userId === requesterUserId) {
        return res.json({ success: true, data: post });
      }
      
      // Allow if requester follows the post author
      if (requesterUserId) {
        const follows = await followsCollection.findOne({
          followerId: requesterUserId,
          followingId: post.userId
        });
        
        if (follows) {
          return res.json({ success: true, data: post });
        }
      }
      
      // Deny access
      return res.status(403).json({ success: false, error: 'User account is private' });
    }
    
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/posts - Create a new post
router.post('/', async (req, res) => {
  try {
    // Accept both 'content' and 'caption' for compatibility
    const { userId, content, caption, imageUrl, mediaUrls, location, locationData, mediaType, category, hashtags, mentions, taggedUserIds } = req.body;
    
    // Validate required fields
    const finalContent = content || caption;
    if (!userId || !finalContent) {
      return res.status(400).json({ success: false, error: 'userId and caption required' });
    }
    
    // Handle both single imageUrl and mediaUrls array
    const images = mediaUrls && mediaUrls.length > 0 ? mediaUrls : (imageUrl ? [imageUrl] : []);
    
    const post = new Post({ 
      userId, 
      content: finalContent,
      caption: finalContent,
      imageUrl: images[0] || null,
      mediaUrls: images,
      location,
      locationData,
      mediaType: mediaType || 'image',
      category,
      hashtags: hashtags || [],
      mentions: mentions || [],
      taggedUserIds: taggedUserIds || []
    });
    
    await post.save();
    console.log('[POST /posts] ✅ Post created:', post._id);
    res.json({ success: true, data: post });
  } catch (err) {
    console.error('[POST /posts] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/posts/:postId - Delete a post
router.delete('/:postId', async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.postId);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/posts/:postId/like - Like a post
router.post('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    const post = await Post.findByIdAndUpdate(
      postId,
      {
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 }
      },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/posts/:postId/like - Unlike a post
router.delete('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    const post = await Post.findByIdAndUpdate(
      postId,
      {
        $pull: { likes: userId },
        $inc: { likesCount: -1 }
      },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
