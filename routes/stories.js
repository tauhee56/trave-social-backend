const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const mongoose = require('mongoose');

/**
 * GET /api/stories
 * Get stories (optionally filtered by userId)
 * Now populates user data (avatar, displayName) from User collection
 */
router.get('/', async (req, res) => {
  try {
    const { userId, requesterUserId } = req.query;
    let query = {};
    if (userId) query.userId = userId;

    // Get active stories (not expired)
    const stories = await Story.find({
      ...query,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    // Populate user data for each story
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const followsCollection = db.collection('follows');

    // Get requester's following list for privacy filtering
    let followingIds = [];
    if (requesterUserId) {
      const following = await followsCollection.find({ followerId: requesterUserId }).toArray();
      followingIds = following.map(f => f.followingId);
    }

    const enrichedStories = await Promise.all(stories.map(async (story) => {
      const storyObj = story.toObject ? story.toObject() : story;

      // Find user data
      const user = await usersCollection.findOne({
        $or: [
          { firebaseUid: story.userId },
          { uid: story.userId },
          { _id: mongoose.Types.ObjectId.isValid(story.userId) ? new mongoose.Types.ObjectId(story.userId) : null }
        ]
      });

      // Check privacy: if user is private and requester is not following, skip story
      if (user?.isPrivate && requesterUserId) {
        const isSelf = story.userId === requesterUserId;
        const isFollowing = followingIds.includes(story.userId);
        if (!isSelf && !isFollowing) {
          return null; // Skip private user's story
        }
      } else if (user?.isPrivate && !requesterUserId) {
        return null; // Skip private user's story if no requester
      }

      // Enrich story with user data
      return {
        ...storyObj,
        userName: user?.displayName || user?.name || storyObj.userName || 'Anonymous',
        userAvatar: user?.avatar || user?.photoURL || null
      };
    }));

    // Filter out null stories (private accounts)
    const filteredStories = enrichedStories.filter(Boolean);

    res.json({ success: true, data: filteredStories });
  } catch (err) {
    console.error('[GET /stories] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stories
 * Create a new story
 * Now fetches user data from User collection
 */
router.post('/', async (req, res) => {
  try {
    const { userId, userName, mediaUrl, mediaType, caption, locationData } = req.body;

    if (!userId || !mediaUrl) {
      return res.status(400).json({ success: false, error: 'userId and mediaUrl required' });
    }

    // Fetch user data from database
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({
      $or: [
        { firebaseUid: userId },
        { uid: userId },
        { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
      ]
    });

    const storyData = {
      userId,
      userName: user?.displayName || user?.name || userName || 'Anonymous',
      userAvatar: user?.avatar || user?.photoURL || null,
      caption: caption || '',
      locationData: locationData || null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    if (mediaType === 'video') {
      storyData.video = mediaUrl;
    } else {
      storyData.image = mediaUrl;
    }

    const story = new Story(storyData);
    await story.save();

    console.log('[POST /stories] Story created:', story._id, 'for user:', user?.displayName || userName);
    res.status(201).json({ success: true, data: story });
  } catch (err) {
    console.error('[POST /stories] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/stories/:storyId
 * Delete a story (only by owner)
 */
router.delete('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { userId } = req.body; // Expecting userId to verify ownership
    
    if (!storyId) {
      return res.status(400).json({ success: false, error: 'storyId required' });
    }

    // Find the story
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    // Verify ownership (if userId provided)
    if (userId && story.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this story' });
    }

    // Delete the story
    await Story.findByIdAndDelete(storyId);

    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
