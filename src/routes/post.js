const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const postController = require('../controllers/postController');

// Create post (POST /api/posts)
router.post('/', postController.createPost);

// Get all posts (GET /api/posts)
router.get('/', postController.getAllPosts);

// Get location count (GET /api/posts/location-count?location=...)
// MUST be before /:id route! Otherwise /:id will match "location-count"
router.get('/location-count', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ success: false, error: 'location query parameter required' });
    }
    
    const Post = require('../models/Post');
    
    // Count posts matching either location or locationName field (case-insensitive)
    const count = await Post.countDocuments({
      $or: [
        { location: { $regex: location, $options: 'i' } },
        { locationName: { $regex: location, $options: 'i' } }
      ]
    });
    
    res.json({ success: true, count, location });
  } catch (error) {
    console.error('Error counting posts by location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get post by ID (GET /api/posts/:id)
router.get('/:id', postController.getPostById);

// Like post (POST /api/posts/:postId/like)
router.post('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body?.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required', body: req.body });
    }
    
    // Convert postId to ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const result = await postsCollection.findOneAndUpdate(
      { _id: objectId },
      [
        { $set: { likes: { $setUnion: ['$likes', [userId]] } } },
        { $set: { likesCount: { $size: '$likes' } } }
      ],
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unlike post (DELETE /api/posts/:postId/like)
router.delete('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body?.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    // Convert postId to ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const result = await postsCollection.findOneAndUpdate(
      { _id: objectId },
      [
        { $set: { likes: { $setDifference: ['$likes', [userId]] } } },
        { $set: { likesCount: { $size: '$likes' } } }
      ],
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
