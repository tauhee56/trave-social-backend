const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Add comment to post
router.post('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, text } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'userId and text required' });
    }
    
    // Convert postId to ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const comment = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      text,
      createdAt: new Date()
    };
    
    // Add comment to post
    const result = await postsCollection.findOneAndUpdate(
      { _id: objectId },
      {
        $push: { comments: comment },
        $inc: { commentsCount: 1 }
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get comments for post
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const objectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const post = await postsCollection.findOne({ _id: objectId });
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: post.comments || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete comment from post
router.delete('/:postId/:commentId', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const postObjectId = mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : postId;
    const commentObjectId = mongoose.Types.ObjectId.isValid(commentId) ? new mongoose.Types.ObjectId(commentId) : commentId;
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const result = await postsCollection.findOneAndUpdate(
      { _id: postObjectId },
      {
        $pull: { comments: { _id: commentObjectId } },
        $inc: { commentsCount: -1 }
      },
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
