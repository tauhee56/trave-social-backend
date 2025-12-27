const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('📌 Loading saved posts route...');

// Saved post schema
const savedPostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  postId: { type: String, required: true },
  savedAt: { type: Date, default: Date.now }
});

const SavedPost = mongoose.models.SavedPost || mongoose.model('SavedPost', savedPostSchema);

// Save a post
router.post('/:userId/saved', async (req, res) => {
  try {
    const { userId } = req.params;
    const { postId } = req.body;
    
    if (!postId) {
      return res.status(400).json({ success: false, error: 'postId required' });
    }
    
    // Check if already saved
    const existing = await SavedPost.findOne({ userId, postId });
    if (existing) {
      return res.json({ success: true, message: 'Already saved' });
    }
    
    const savedPost = new SavedPost({ userId, postId });
    await savedPost.save();
    
    res.json({ success: true, data: savedPost });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unsave a post
router.delete('/:userId/saved/:postId', async (req, res) => {
  try {
    const { userId, postId } = req.params;
    await SavedPost.deleteOne({ userId, postId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get saved posts for user
router.get('/:userId/saved', async (req, res) => {
  try {
    const { userId } = req.params;
    const savedPosts = await SavedPost.find({ userId }).sort({ savedAt: -1 });
    
    // Get full post details
    const postIds = savedPosts.map(s => s.postId);
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const posts = await postsCollection.find({
      _id: { $in: postIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) }
    }).toArray();
    
    res.json({ success: true, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
