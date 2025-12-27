const express = require('express');
const router = express.Router();

// Return a static logo URL or null for now
router.get('/', (req, res) => {
  res.json({ url: 'https://yourdomain.com/logo.png' });
});

module.exports = router;
