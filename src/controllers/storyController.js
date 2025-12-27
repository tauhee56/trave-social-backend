const Story = require('../models/Story');

// GET /api/stories?userId=...
exports.getStoriesByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    // Only return non-expired stories
    const now = new Date();
    const stories = await Story.find({ userId, expiresAt: { $gt: now } }).sort({ createdAt: -1 });
    res.json({ success: true, data: stories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
