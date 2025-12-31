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
    
    const Post = mongoose.model('Post');
    
    // First try finding by ObjectId (real MongoDB post)
    let result = null;
    if (mongoose.Types.ObjectId.isValid(postId)) {
      const objectId = new mongoose.Types.ObjectId(postId);
      result = await Post.findByIdAndUpdate(
        objectId,
        { $addToSet: { likes: userId } }, // $addToSet prevents duplicates
        { new: true }
      );
    }
    
    // If not found by ObjectId, try finding by string ID (generated posts)
    if (!result) {
      result = await Post.findOneAndUpdate(
        { id: postId },
        { $addToSet: { likes: userId } },
        { new: true }
      );
    }
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: result });
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
    
    const Post = mongoose.model('Post');
    
    // First try finding by ObjectId (real MongoDB post)
    let result = null;
    if (mongoose.Types.ObjectId.isValid(postId)) {
      const objectId = new mongoose.Types.ObjectId(postId);
      result = await Post.findByIdAndUpdate(
        objectId,
        { $pull: { likes: userId } }, // $pull removes from array
        { new: true }
      );
    }
    
    // If not found by ObjectId, try finding by string ID (generated posts)
    if (!result) {
      result = await Post.findOneAndUpdate(
        { id: postId },
        { $pull: { likes: userId } },
        { new: true }
      );
    }
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
