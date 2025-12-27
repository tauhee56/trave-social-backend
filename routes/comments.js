const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Comment model (define properly in models/Comment.js in real use)
const Comment = mongoose.model('Comment', new mongoose.Schema({
  postId: String,
  userId: String,
  userName: String,
  userAvatar: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
  likes: [String],
  likesCount: { type: Number, default: 0 },
  replies: [Object],
  reactions: Object
}));

// Add a comment to a post
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const { userId, userName, userAvatar, text } = req.body;
    const comment = new Comment({
      postId: req.params.postId,
      userId,
      userName,
      userAvatar,
      text
    });
    await comment.save();
    res.json({ success: true, id: comment._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all comments for a post
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: -1 });
    res.json({ success: true, data: comments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit a comment
router.patch('/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (comment.userId !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });
    comment.text = text;
    comment.editedAt = new Date();
    await comment.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a comment
router.delete('/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    const { userId } = req.body;
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (comment.userId !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });
    await comment.remove();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TODO: Add endpoints for replies and reactions as needed

module.exports = router;
