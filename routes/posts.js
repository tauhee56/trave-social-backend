const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Post model (define properly in models/Post.js in real use)
let Post;
try {
  Post = mongoose.model('Post');
} catch {
  Post = mongoose.model('Post', new mongoose.Schema({
    userId: String,
    content: String,
    imageUrl: String,
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }));
}

// GET /api/posts - Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: posts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// GET /api/posts/feed - Get feed posts
router.get('/feed', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: posts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// GET /api/posts/:postId - Get a post by ID
router.get('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/posts - Create a new post
router.post('/', async (req, res) => {
  try {
    const { userId, content, imageUrl } = req.body;
    const post = new Post({ userId, content, imageUrl });
    await post.save();
    res.json({ success: true, data: post });
  } catch (err) {
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
    
    // Convert postId to ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    // Add user to likes array if not already there
    const post = await postsCollection.findOneAndUpdate(
      { _id: objectId },
      {
        $addToSet: { likes: userId },  // Only add if not already in array
        $inc: { likesCount: 1 }
      },
      { new: true, returnDocument: 'after' }
    );
    
    if (!post.value) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: post.value });
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
    
    // Convert postId to ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    // Remove user from likes array
    const post = await postsCollection.findOneAndUpdate(
      { _id: objectId },
      {
        $pull: { likes: userId },  // Remove from array
        $inc: { likesCount: -1 }
      },
      { new: true, returnDocument: 'after' }
    );
    
    if (!post.value) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: post.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
