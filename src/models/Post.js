const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
  visits: { type: Number, default: 0 },
  likes: [String],
  comments: [{
    userId: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Post', PostSchema);
