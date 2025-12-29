const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: String,
  likes: { type: [String], default: [] }, // Array of userIds who liked
  likesCount: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);
