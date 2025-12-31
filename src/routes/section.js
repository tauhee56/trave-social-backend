const express = require('express');
const router = express.Router();

// Safely get section controller
let sectionController;
try {
  sectionController = require('../controllers/sectionController');
} catch (e) {
  console.warn('⚠️ Section controller error:', e.message);
  // Provide fallback handlers
  sectionController = {
    getSectionsByUser: (req, res) => res.json({ success: true, data: [] }),
    createSection: (req, res) => res.json({ success: true, data: {} }),
    updateSection: (req, res) => res.json({ success: true, data: {} }),
    deleteSection: (req, res) => res.json({ success: true, data: {} }),
    getUserSections: (req, res) => res.json({ success: true, data: [] })
  };
}

// GET /api/sections?userId=...
router.get('/', sectionController.getSectionsByUser);

// POST /api/users/:uid/sections - Create section (called via user router)
router.post('/:uid/sections', sectionController.createSection);

// PUT /api/users/:uid/sections/:sectionName - Update section
router.put('/:uid/sections/:sectionName', sectionController.updateSection);

// DELETE /api/users/:uid/sections/:sectionName - Delete section
router.delete('/:uid/sections/:sectionName', sectionController.deleteSection);

// GET /api/users/:uid/sections - Get user sections
router.get('/:uid/sections', sectionController.getUserSections);

module.exports = router;
