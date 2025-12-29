const express = require('express');
const router = express.Router();


const Category = require('../models/Category');

// GET /api/categories - Return all categories from DB
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ success: true, data: Array.isArray(categories) ? categories : [] });
  } catch (err) {
    res.status(200).json({ success: true, data: [] });
  }
});

// POST /api/categories - Add a new category
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const category = new Category({ name });
    await category.save();
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
