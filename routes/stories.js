const express = require('express');
const router = express.Router();

/**
 * GET /api/stories
 * Get stories (optionally filtered by userId)
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    // Return empty array for now (placeholder)
    res.json({ success: true, data: [] });
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
    res.json({ success: true, id: 'story_' + Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
