// Try to get Section model, use mongoose.model as fallback
let Section;
try {
  Section = require('../models/Section');
} catch (e) {
  // Model might already be registered
  try {
    const mongoose = require('mongoose');
    Section = mongoose.model('Section');
  } catch (e2) {
    console.error('Failed to load Section model:', e2.message);
  }
}

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

// GET /api/users/:uid/sections - Get user sections
exports.getUserSections = async (req, res) => {
  try {
    const { uid } = req.params;
    const sections = await Section.find({ userId: uid }).sort({ createdAt: 1 });
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/users/:uid/sections - Create section
exports.createSection = async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, stories } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Section name required' });
    }
    
    const section = new Section({
      userId: uid,
      name,
      stories: stories || [],
      createdAt: new Date()
    });
    
    await section.save();
    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/users/:uid/sections/:sectionName - Update section
exports.updateSection = async (req, res) => {
  try {
    const { uid, sectionName } = req.params;
    const { name, stories } = req.body;
    
    const section = await Section.findOneAndUpdate(
      { userId: uid, name: sectionName },
      { name: name || sectionName, stories: stories || [] },
      { new: true }
    );
    
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/users/:uid/sections/:sectionName - Delete section
exports.deleteSection = async (req, res) => {
  try {
    const { uid, sectionName } = req.params;
    
    const result = await Section.findOneAndDelete(
      { userId: uid, name: sectionName }
    );
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
