const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId: String,
  userName: String,
  image: String,
  video: String,
  caption: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
});

module.exports = mongoose.model('Story', storySchema);
