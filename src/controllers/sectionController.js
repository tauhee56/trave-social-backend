const Section = require('../models/Section');

// GET /api/sections?userId=...
exports.getSectionsByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const sections = await Section.find({ userId }).sort({ createdAt: 1 });
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
