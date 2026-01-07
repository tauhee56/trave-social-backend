const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../../models/Post');

// ============= SAVED POSTS ROUTES =============
// Base path: /api/users/:userId/saved

// POST - Save a post
router.post('/:userId/saved', async (req, res) => {
    try {
        const { userId } = req.params;
        const { postId } = req.body;

        console.log('[SAVED] POST /users/:userId/saved - Saving post:', postId, 'for user:', userId);

        if (!userId || !postId) {
            return res.status(400).json({ success: false, error: 'Missing userId or postId' });
        }

        // Find user by MongoDB _id or Firebase uid
        let user = await User.findById(userId);
        if (!user) {
            user = await User.findOne({ uid: userId });
        }

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Check if already saved
        if (user.savedPosts && user.savedPosts.includes(postId)) {
            return res.json({ success: true, message: 'Post already saved' });
        }

        // Add to user's savedPosts
        if (!user.savedPosts) {
            user.savedPosts = [];
        }
        user.savedPosts.push(postId);
        await user.save();

        // Also update post's savedBy array
        try {
            const post = await Post.findById(postId);
            if (post) {
                if (!post.savedBy) post.savedBy = [];
                if (!post.savedBy.includes(userId)) {
                    post.savedBy.push(userId);
                    post.savesCount = (post.savesCount || 0) + 1;
                    await post.save();
                }
            }
        } catch (postErr) {
            console.warn('[SAVED] Could not update post.savedBy:', postErr.message);
        }

        console.log('[SAVED] Post saved successfully. User now has', user.savedPosts.length, 'saved posts');
        return res.json({ success: true, message: 'Post saved successfully' });

    } catch (err) {
        console.error('[SAVED] POST /users/:userId/saved error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE - Unsave a post
router.delete('/:userId/saved/:postId', async (req, res) => {
    try {
        const { userId, postId } = req.params;

        console.log('[SAVED] DELETE /users/:userId/saved/:postId - Unsaving post:', postId, 'for user:', userId);

        if (!userId || !postId) {
            return res.status(400).json({ success: false, error: 'Missing userId or postId' });
        }

        // Find user
        let user = await User.findById(userId);
        if (!user) {
            user = await User.findOne({ uid: userId });
        }

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Remove from user's savedPosts
        if (user.savedPosts) {
            user.savedPosts = user.savedPosts.filter(id => id !== postId && id.toString() !== postId);
            await user.save();
        }

        // Also update post's savedBy array
        try {
            const post = await Post.findById(postId);
            if (post) {
                if (post.savedBy) {
                    post.savedBy = post.savedBy.filter(id => id !== userId && id.toString() !== userId);
                    post.savesCount = Math.max((post.savesCount || 1) - 1, 0);
                    await post.save();
                }
            }
        } catch (postErr) {
            console.warn('[SAVED] Could not update post.savedBy:', postErr.message);
        }

        console.log('[SAVED] Post unsaved successfully. User now has', user.savedPosts?.length || 0, 'saved posts');
        return res.json({ success: true, message: 'Post unsaved successfully' });

    } catch (err) {
        console.error('[SAVED] DELETE /users/:userId/saved/:postId error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET - Get user's saved posts
router.get('/:userId/saved', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50 } = req.query;

        console.log('[SAVED] GET /users/:userId/saved - Getting saved posts for user:', userId);

        if (!userId) {
            return res.status(400).json({ success: false, error: 'Missing userId' });
        }

        // Find user
        let user = await User.findById(userId);
        if (!user) {
            user = await User.findOne({ uid: userId });
        }

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found', data: [] });
        }

        // Get saved post IDs
        const savedPostIds = user.savedPosts || [];
        console.log('[SAVED] User has', savedPostIds.length, 'saved posts');

        if (savedPostIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // Fetch the actual posts
        const posts = await Post.find({
            _id: {
                $in: savedPostIds.map(id => {
                    try {
                        return new mongoose.Types.ObjectId(id);
                    } catch {
                        return id;
                    }
                })
            }
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        console.log('[SAVED] Returning', posts.length, 'saved posts');
        return res.json({ success: true, data: posts });

    } catch (err) {
        console.error('[SAVED] GET /users/:userId/saved error:', err.message);
        return res.status(500).json({ success: false, error: err.message, data: [] });
    }
});

module.exports = router;
