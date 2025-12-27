const mongoose = require('mongoose');

const HighlightSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  coverImage: { type: String },
  stories: [
    {
      id: String,
      image: String
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Highlight', HighlightSchema);