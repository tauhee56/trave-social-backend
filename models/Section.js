const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  userId: String,
  title: String,
  description: String,
  image: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Section', sectionSchema);
