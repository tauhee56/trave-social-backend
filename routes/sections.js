const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Section model with cover image and posts
const sectionSchema = new mongoose.Schema({
  userId: String,
  name: String,
  order: Number,
  coverImage: String,
  posts: [String], // Array of post IDs
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Section = mongoose.models.Section || mongoose.model('Section', sectionSchema);

// POST /api/sections - Create a new section
router.post('/', async (req, res) => {
  try {
    const { userId, name, coverImage, posts } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ success: false, error: 'userId and name required' });
    }

    // Get max order for this user
    const lastSection = await Section.findOne({ userId }).sort({ order: -1 });
    const nextOrder = (lastSection?.order || 0) + 1;

    const section = new Section({
      userId,
      name,
      order: nextOrder,
      coverImage: coverImage || null,
      posts: posts || []
    });
    await section.save();

    console.log('[POST /sections] Section created:', section._id, 'for user:', userId);
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    console.error('[POST /sections] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get user sections
router.get('/users/:userId/sections', async (req, res) => {
  try {
    const sections = await Section.find({ userId: req.params.userId }).sort({ order: 1 });
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sections - Get sections (optionally filtered by userId)
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    let sections = [];
    if (userId) {
      sections = await Section.find({ userId }).sort({ order: 1 });
    } else {
      sections = await Section.find().sort({ order: 1 });
    }
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/sections/:sectionId - Update a specific section
router.patch('/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name, coverImage, posts, order } = req.body;

    const updateData = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (posts !== undefined) updateData.posts = posts;
    if (order !== undefined) updateData.order = order;

    const section = await Section.findByIdAndUpdate(
      sectionId,
      updateData,
      { new: true }
    );

    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    console.log('[PATCH /sections/:sectionId] Section updated:', sectionId);
    res.json({ success: true, data: section });
  } catch (err) {
    console.error('[PATCH /sections/:sectionId] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/sections/:sectionId - Delete a section
router.delete('/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const section = await Section.findByIdAndDelete(sectionId);

    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    console.log('[DELETE /sections/:sectionId] Section deleted:', sectionId);
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (err) {
    console.error('[DELETE /sections/:sectionId] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update section order (batch update)
router.patch('/users/:userId/sections-order', async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ success: false, error: 'sections array required' });
    }

    // Update all sections in a single operation
    const updatePromises = sections.map((section, index) =>
      Section.updateOne(
        { _id: section._id || section.id },
        { order: index, updatedAt: new Date() }
      )
    );

    await Promise.all(updatePromises);

    console.log('[PATCH /sections-order] Updated order for', sections.length, 'sections');
    res.json({ success: true, message: 'Section order updated successfully' });
  } catch (err) {
    console.error('[PATCH /sections-order] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
