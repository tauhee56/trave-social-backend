const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');

// GET /api/stories?userId=...
router.get('/', storyController.getStoriesByUser);

module.exports = router;
