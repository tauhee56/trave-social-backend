const express = require('express');
const router = express.Router();
const Story = require('../models/Story');

/**
 * GET /api/stories
 * Get stories (optionally filtered by userId)
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = {};
    if (userId) query.userId = userId;
    
    // Get active stories (not expired)
    const stories = await Story.find({
      ...query,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    
    res.json({ success: true, data: stories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stories
 * Create a new story
 */
router.post('/', async (req, res) => {
  try {
    const { userId, userName, mediaUrl, mediaType, caption, locationData } = req.body;
    
    if (!userId || !mediaUrl) {
      return res.status(400).json({ success: false, error: 'userId and mediaUrl required' });
    }

    const storyData = {
      userId,
      userName: userName || 'Anonymous',
      caption: caption || '',
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

    res.status(201).json({ success: true, data: story });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
