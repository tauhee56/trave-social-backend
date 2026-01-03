const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

console.log('📨 Loading conversations route...');

// Get the Conversation model (already defined in models/Conversation.js and required in index.js)
const Conversation = mongoose.model('Conversation');

// Get conversations for user with populated participant data
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId query parameter required' });
    }

    console.log('[GET] /conversations - Fetching for userId:', userId);

    const conversations = await Conversation.find({ participants: userId }).sort({ lastMessageAt: -1 });
    
    console.log('[GET] /conversations - Found', conversations.length, 'conversations for user:', userId);
    conversations.forEach((c, i) => {
      console.log(`  [${i}] conversationId: ${c.conversationId}, participants: ${c.participants}, messages: ${c.messages?.length || 0}`);
    });

    // Populate participant data
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const enrichedConversations = await Promise.all(conversations.map(async (conversation) => {
      const convObj = conversation.toObject ? conversation.toObject() : conversation;

      // Get other participant (not current user)
      const otherParticipantId = convObj.participants.find(p => p !== userId);

      if (otherParticipantId) {
        const otherUser = await usersCollection.findOne({
          $or: [
            { firebaseUid: otherParticipantId },
            { uid: otherParticipantId },
            { _id: mongoose.Types.ObjectId.isValid(otherParticipantId) ? new mongoose.Types.ObjectId(otherParticipantId) : null }
          ]
        });

        return {
          ...convObj,
          otherParticipant: {
            id: otherParticipantId,
            name: otherUser?.displayName || otherUser?.name || 'User',
            avatar: otherUser?.avatar || otherUser?.photoURL || null
          }
        };
      }

      return convObj;
    }));

    console.log('[GET] /conversations - Returning', enrichedConversations.length, 'enriched conversations');
    res.json({ success: true, data: enrichedConversations || [] });
  } catch (err) {
    console.error('[GET /conversations] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get messages for a conversation
router.get('/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    
    // Try to find by string ID first, then by MongoDB ObjectId
    let convo = await Conversation.findOne({ 
      $or: [
        { conversationId: conversationId },
        { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
      ]
    });
    
    if (!convo) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true, messages: convo.messages || [] });
  } catch (err) {
    console.error('[GET] /:id/messages - Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send a message in a conversation (POST /:id/messages)
router.post('/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { senderId, sender, text, recipientId, replyTo, read } = req.body;
    
    // Accept both senderId and sender for compatibility
    const actualSenderId = senderId || sender;
    if (!actualSenderId || !text) {
      return res.status(400).json({ success: false, error: 'Missing senderId and/or text' });
    }

    // Try to find by string ID first, then by MongoDB ObjectId
    let convo = await Conversation.findOne({ 
      $or: [
        { conversationId: conversationId },
        { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
      ]
    });
    
    if (!convo) {
      console.log('[POST] /:id/messages - Conversation not found, creating new one:', conversationId);
      // Conversation doesn't exist yet, create it
      // Use actual IDs from request body to avoid parsing issues with underscores in user IDs
      const participants = [actualSenderId];
      if (recipientId) {
        participants.push(recipientId);
      }
      
      if (participants.length < 2) {
        console.error('[POST] ERROR: Cannot create conversation without 2 participants! Got:', participants);
        return res.status(400).json({ success: false, error: 'Requires both senderId and recipientId' });
      }
      
      console.log('[POST] Creating conversation with participants:', participants, 'senderId:', actualSenderId, 'recipientId:', recipientId);
      
      convo = new Conversation({ 
        conversationId: conversationId,
        participants: participants.sort()
      });
    }
    
    // Initialize messages array if it doesn't exist
    if (!convo.messages) {
      convo.messages = [];
    }
    
    const message = { 
      senderId: actualSenderId, 
      text,
      read: read || false,
      timestamp: new Date()
    };
    
    // Add recipientId if provided
    if (recipientId) {
      message.recipientId = recipientId;
    }
    
    // Add replyTo if replying to a message
    if (replyTo) {
      message.replyTo = replyTo;
    }
    
    // Add an ID to the message for easier deletion/editing
    message.id = new mongoose.Types.ObjectId().toString();
    
    convo.messages.push(message);
    convo.lastMessage = text;
    convo.lastMessageAt = new Date();
    convo.updatedAt = new Date();
    await convo.save();
    
    console.log('[POST] /:id/messages - Message saved successfully!');
    console.log('[POST] Conversation state after save:', {
      conversationId: convo.conversationId,
      participants: convo.participants,
      messageCount: convo.messages?.length,
      lastMessage: convo.lastMessage
    });
    
    res.json({ success: true, message });
  } catch (err) {
    console.error('[POST] /:id/messages - Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or create conversation
router.post('/get-or-create', async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;
    const ids = [userId1, userId2].sort();
    const conversationId = `${ids[0]}_${ids[1]}`;
    
    let conversation = await Conversation.findOne({
      $or: [
        { conversationId: conversationId },
        { participants: { $all: [userId1, userId2] } }
      ]
    });
    
    if (!conversation) {
      conversation = new Conversation({ 
        conversationId: conversationId,
        participants: [userId1, userId2] 
      });
      await conversation.save();
    }
    
    res.json({ success: true, id: conversation._id, conversationId: conversationId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get conversations for user (route param version) with populated data
router.get('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const conversations = await Conversation.find({ participants: userId }).sort({ lastMessageAt: -1 });

    // Populate participant data
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const enrichedConversations = await Promise.all(conversations.map(async (conversation) => {
      const convObj = conversation.toObject ? conversation.toObject() : conversation;

      // Get other participant (not current user)
      const otherParticipantId = convObj.participants.find(p => p !== userId);

      if (otherParticipantId) {
        const otherUser = await usersCollection.findOne({
          $or: [
            { firebaseUid: otherParticipantId },
            { uid: otherParticipantId },
            { _id: mongoose.Types.ObjectId.isValid(otherParticipantId) ? new mongoose.Types.ObjectId(otherParticipantId) : null }
          ]
        });

        return {
          ...convObj,
          otherParticipant: {
            id: otherParticipantId,
            name: otherUser?.displayName || otherUser?.name || 'User',
            avatar: otherUser?.avatar || otherUser?.photoURL || null
          }
        };
      }

      return convObj;
    }));

    res.json({ success: true, data: enrichedConversations });
  } catch (err) {
    console.error('[GET /conversations/users/:userId] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
