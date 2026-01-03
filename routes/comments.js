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

// Add reaction to a comment (POST /api/posts/:postId/comments/:commentId/react)
router.post('/posts/:postId/comments/:commentId/react', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, emoji } = req.body;

    if (!userId || !emoji) {
      return res.status(400).json({ success: false, error: 'userId and emoji required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Initialize reactions object if not exists
    if (!comment.reactions) {
      comment.reactions = {};
    }

    // Initialize emoji array if not exists
    if (!comment.reactions[emoji]) {
      comment.reactions[emoji] = [];
    }

    // Check if user already reacted with this emoji
    const existingIndex = comment.reactions[emoji].indexOf(userId);
    if (existingIndex > -1) {
      // Remove reaction (toggle off)
      comment.reactions[emoji].splice(existingIndex, 1);
      // Remove emoji key if no reactions left
      if (comment.reactions[emoji].length === 0) {
        delete comment.reactions[emoji];
      }
    } else {
      // Add reaction
      comment.reactions[emoji].push(userId);
    }

    // Mark reactions as modified for Mongoose
    comment.markModified('reactions');
    await comment.save();

    // Calculate total reaction count
    const reactionCount = Object.values(comment.reactions).reduce((sum, users) => sum + users.length, 0);

    console.log('[POST /comments/:commentId/react] Reaction updated:', emoji, 'Total:', reactionCount);
    res.json({
      success: true,
      data: comment,
      reactionCount,
      reactions: comment.reactions
    });
  } catch (err) {
    console.error('[POST /comments/:commentId/react] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get reactions for a comment (GET /api/posts/:postId/comments/:commentId/reactions)
router.get('/posts/:postId/comments/:commentId/reactions', async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    const reactions = comment.reactions || {};
    const reactionCount = Object.values(reactions).reduce((sum, users) => sum + users.length, 0);

    res.json({
      success: true,
      reactions,
      reactionCount
    });
  } catch (err) {
    console.error('[GET /comments/:commentId/reactions] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Like a comment (POST /api/posts/:postId/comments/:commentId/like)
router.post('/posts/:postId/comments/:commentId/like', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Initialize likes array if not exists
    if (!comment.likes) {
      comment.likes = [];
    }

    // Check if already liked
    if (comment.likes.includes(userId)) {
      return res.json({ success: false, error: 'Already liked', alreadyLiked: true });
    }

    comment.likes.push(userId);
    comment.likesCount = comment.likes.length;
    await comment.save();

    console.log('[POST /comments/:commentId/like] Comment liked, total:', comment.likesCount);
    res.json({
      success: true,
      data: comment,
      likesCount: comment.likesCount
    });
  } catch (err) {
    console.error('[POST /comments/:commentId/like] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unlike a comment (DELETE /api/posts/:postId/comments/:commentId/like)
router.delete('/posts/:postId/comments/:commentId/like', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Remove like
    if (comment.likes) {
      comment.likes = comment.likes.filter(id => id !== userId);
      comment.likesCount = comment.likes.length;
      await comment.save();
    }

    console.log('[DELETE /comments/:commentId/like] Comment unliked, total:', comment.likesCount);
    res.json({
      success: true,
      data: comment,
      likesCount: comment.likesCount
    });
  } catch (err) {
    console.error('[DELETE /comments/:commentId/like] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
