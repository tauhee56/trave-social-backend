const express = require('express');
const router = express.Router();

// Dummy live streams array (replace with DB fetch if needed)
const liveStreams = [];

// GET /api/live-streams - Return all live streams (empty array if none)
router.get('/', (req, res) => {
  res.json({ success: true, data: liveStreams });
});

module.exports = router;
