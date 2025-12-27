const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');

// GET /api/sections?userId=...
router.get('/', sectionController.getSectionsByUser);

module.exports = router;
