// models/Conversation.js
const mongoose = require('mongoose');
const ConversationSchema = new mongoose.Schema({
  participants: [String], // user IDs
  messages: [{
    id: String,
    senderId: String,
    sender: String,
    text: String,
    recipientId: String,
    replyTo: {
      id: String,
      text: String,
      senderId: String
    },
    reactions: {
      type: Map,
      of: String
    },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
  }],
  lastMessage: String,
  lastMessageAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Conversation', ConversationSchema);
