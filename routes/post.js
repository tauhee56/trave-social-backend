const express = require('express');
const router = express.Router();

// Dummy posts array (replace with DB fetch if needed)
const posts = [];

// GET /api/posts - Return all posts (empty array if none)
router.get('/', (req, res) => {
  res.json({ success: true, data: posts });
});

module.exports = router;
