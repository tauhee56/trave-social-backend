const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  image: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  // Add more fields as needed
});

module.exports = mongoose.model('Story', StorySchema);