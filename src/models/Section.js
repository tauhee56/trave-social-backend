const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  postIds: [String],
  coverImage: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Section', SectionSchema);