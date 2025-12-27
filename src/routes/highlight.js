const express = require('express');
const router = express.Router();
const highlightController = require('../controllers/highlightController');

// GET /api/highlights?userId=...
router.get('/', highlightController.getHighlightsByUser);

module.exports = router;
