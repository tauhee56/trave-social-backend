const express = require('express');
const router = express.Router();


const mediaController = require('../controllers/mediaController');

// Upload image (POST /api/media/upload)
router.post('/upload', mediaController.uploadImage);

module.exports = router;
