const Highlight = require('../models/Highlight');

// GET /api/highlights?userId=...
exports.getHighlightsByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const highlights = await Highlight.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: highlights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
