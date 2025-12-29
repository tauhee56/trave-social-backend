const express = require('express');
const router = express.Router();

// Example categories (replace with DB fetch if needed)
const categories = [
  { id: '1', name: 'Travel' },
  { id: '2', name: 'Food' },
  { id: '3', name: 'Adventure' },
  { id: '4', name: 'Culture' },
  { id: '5', name: 'Nature' }
];

// GET /api/categories - Return all categories
router.get('/', (req, res) => {
  res.json({ success: true, data: categories });
});

module.exports = router;
