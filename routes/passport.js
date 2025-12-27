const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('🎫 Loading passport routes...');

// Passport model with proper check
const passportSchema = new mongoose.Schema({
  userId: String,
  ticketCount: { type: Number, default: 0 },
  locations: [{ 
    city: String, 
    country: String, 
    lat: Number, 
    lon: Number, 
    visitedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Passport = mongoose.models.Passport || mongoose.model('Passport', passportSchema);

// Get passport for user
router.get('/users/:userId/passport', async (req, res) => {
  try {
    let passport = await Passport.findOne({ userId: req.params.userId });
    if (!passport) {
      passport = { ticketCount: 0, locations: [] };
    }
    res.json({ success: true, data: passport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add location to passport
router.post('/users/:userId/passport/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { city, country, lat, lon } = req.body;
    
    if (!city || !country) {
      return res.status(400).json({ success: false, error: 'city and country required' });
    }
    
    let passport = await Passport.findOne({ userId });
    if (!passport) {
      passport = new Passport({ userId, locations: [], ticketCount: 0 });
    }
    
    // Check if location already exists
    const exists = passport.locations.some(l => l.city === city && l.country === country);
    if (!exists) {
      passport.locations.push({ city, country, lat, lon });
      passport.ticketCount = passport.locations.length;
      await passport.save();
    }
    
    res.json({ success: true, data: passport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove location from passport
router.delete('/users/:userId/passport/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { city, country } = req.body;
    
    let passport = await Passport.findOne({ userId });
    if (passport) {
      passport.locations = passport.locations.filter(l => !(l.city === city && l.country === country));
      passport.ticketCount = passport.locations.length;
      await passport.save();
    }
    
    res.json({ success: true, data: passport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
