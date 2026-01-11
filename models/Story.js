const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userAvatar: String,
  image: String,
  video: String,
  thumbnail: String,
  caption: String,
  locationData: Object,
  views: [String],
  likes: [String],
  comments: [Object],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
});

module.exports = mongoose.model('Story', storySchema);
