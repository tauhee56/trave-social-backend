// models/Conversation.js
const mongoose = require('mongoose');
const ConversationSchema = new mongoose.Schema({
  participants: [String], // user IDs
  messages: [{
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
});
module.exports = mongoose.model('Conversation', ConversationSchema);
