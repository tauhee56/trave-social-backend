const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { verifyToken } = require('../src/middleware/authMiddleware');

console.log('📨 Loading conversations route...');

// Get the Conversation model (already defined in models/Conversation.js and required in index.js)
const Conversation = mongoose.model('Conversation');

const findConversationByAnyId = async (id) => {
  if (!id) return null;
  return Conversation.findOne({
    $or: [
      { conversationId: String(id) },
      { _id: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null }
    ]
  });
};

const resolveUserIdVariants = async (id) => {
  const User = mongoose.model('User');
  const out = new Set([String(id)]);
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      const byId = await User.findById(id).select('_id firebaseUid uid');
      if (byId?._id) out.add(String(byId._id));
      if (byId?.firebaseUid) out.add(String(byId.firebaseUid));
      if (byId?.uid) out.add(String(byId.uid));
    }

    const byAlt = await User.findOne({ $or: [{ firebaseUid: id }, { uid: id }] }).select('_id firebaseUid uid');
    if (byAlt?._id) out.add(String(byAlt._id));
    if (byAlt?.firebaseUid) out.add(String(byAlt.firebaseUid));
    if (byAlt?.uid) out.add(String(byAlt.uid));
  } catch {}
  return Array.from(out);
};

const findThreadConversations = async (conversation) => {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants.map(String) : [];
  if (participants.length !== 2) return [conversation];

  const aIds = await resolveUserIdVariants(participants[0]);
  const bIds = await resolveUserIdVariants(participants[1]);

  return Conversation.find({
    $and: [
      { participants: { $in: aIds } },
      { participants: { $in: bIds } },
      { $expr: { $eq: [{ $size: '$participants' }, 2] } }
    ]
  });
};

// Get conversations for user with populated participant data
router.get('/', verifyToken, async (req, res) => {
  try {
    const userIdFromToken = req.userId;
    const firebaseUidFromToken = req.user?.firebaseUid;
    const userId = userIdFromToken;

    console.log('[GET] /conversations - Fetching for userId:', userId);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idsToMatch = [String(userId)];
    if (firebaseUidFromToken) idsToMatch.push(String(firebaseUidFromToken));

    const conversations = await Conversation.find({
      participants: { $in: idsToMatch },
      deletedBy: { $nin: idsToMatch }
    }).sort({ lastMessageAt: -1 });
    
    console.log('[GET] /conversations - Found', conversations.length, 'conversations for user:', userId);
    conversations.forEach((c, i) => {
      console.log(`  [${i}] conversationId: ${c.conversationId}, participants: ${c.participants}, messages: ${c.messages?.length || 0}`);
    });

    // Populate participant data
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const enrichedConversations = await Promise.all(conversations.map(async (conversation) => {
      const convObj = conversation.toObject ? conversation.toObject() : conversation;

      const archivedBy = Array.isArray(convObj?.archivedBy) ? convObj.archivedBy.map(String) : [];
      const isArchived = archivedBy.some((id) => idsToMatch.includes(String(id)));

      // Get other participant (not current user)
      const participants = Array.isArray(convObj?.participants) ? convObj.participants.map(String) : [];
      const otherParticipantId = participants.find(p => !idsToMatch.includes(String(p)));

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
          [`archived_${String(userId)}`]: isArchived,
          isArchived,
          otherParticipant: {
            id: otherParticipantId,
            name: otherUser?.displayName || otherUser?.name || 'User',
            avatar: otherUser?.avatar || otherUser?.photoURL || null
          }
        };
      }

      return {
        ...convObj,
        [`archived_${String(userId)}`]: isArchived,
        isArchived,
      };
    }));

    console.log('[GET] /conversations - Returning', enrichedConversations.length, 'enriched conversations');
    res.json({ success: true, data: enrichedConversations || [] });
  } catch (err) {
    console.error('[GET /conversations] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Archive conversation for authenticated user (soft archive)
router.post('/:id/archive', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userIdFromToken = req.userId;
    const firebaseUidFromToken = req.user?.firebaseUid;

    if (!userIdFromToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idsToMatch = [String(userIdFromToken)];
    if (firebaseUidFromToken) idsToMatch.push(String(firebaseUidFromToken));

    const conversation = await findConversationByAnyId(id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const participants = Array.isArray(conversation?.participants) ? conversation.participants.map(String) : [];
    const allowed = idsToMatch.some(uid => participants.includes(String(uid)));
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const threadConvos = await findThreadConversations(conversation);
    const convoIds = Array.isArray(threadConvos) && threadConvos.length > 0
      ? threadConvos.map(c => c._id)
      : [conversation._id];

    await Conversation.updateMany(
      { _id: { $in: convoIds } },
      {
        $addToSet: { archivedBy: { $each: idsToMatch } },
        $pull: { deletedBy: { $in: idsToMatch } }
      }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[POST] /conversations/:id/archive - Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Unarchive conversation for authenticated user
router.post('/:id/unarchive', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userIdFromToken = req.userId;
    const firebaseUidFromToken = req.user?.firebaseUid;

    if (!userIdFromToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idsToMatch = [String(userIdFromToken)];
    if (firebaseUidFromToken) idsToMatch.push(String(firebaseUidFromToken));

    const conversation = await findConversationByAnyId(id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const participants = Array.isArray(conversation?.participants) ? conversation.participants.map(String) : [];
    const allowed = idsToMatch.some(uid => participants.includes(String(uid)));
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const threadConvos = await findThreadConversations(conversation);
    const convoIds = Array.isArray(threadConvos) && threadConvos.length > 0
      ? threadConvos.map(c => c._id)
      : [conversation._id];

    await Conversation.updateMany(
      { _id: { $in: convoIds } },
      { $pull: { archivedBy: { $in: idsToMatch } } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[POST] /conversations/:id/unarchive - Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete conversation for authenticated user (soft delete / hide from inbox)
router.post('/:id/delete', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userIdFromToken = req.userId;
    const firebaseUidFromToken = req.user?.firebaseUid;

    if (!userIdFromToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idsToMatch = [String(userIdFromToken)];
    if (firebaseUidFromToken) idsToMatch.push(String(firebaseUidFromToken));

    const conversation = await findConversationByAnyId(id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const participants = Array.isArray(conversation?.participants) ? conversation.participants.map(String) : [];
    const allowed = idsToMatch.some(uid => participants.includes(String(uid)));
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const threadConvos = await findThreadConversations(conversation);
    const convoIds = Array.isArray(threadConvos) && threadConvos.length > 0
      ? threadConvos.map(c => c._id)
      : [conversation._id];

    await Conversation.updateMany(
      { _id: { $in: convoIds } },
      {
        $addToSet: { deletedBy: { $each: idsToMatch } },
        $pull: { archivedBy: { $in: idsToMatch } }
      }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[POST] /conversations/:id/delete - Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get messages for a conversation
router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const userIdFromToken = req.userId;
    const firebaseUidFromToken = req.user?.firebaseUid;
    const idsToMatch = [String(userIdFromToken)];
    if (firebaseUidFromToken) idsToMatch.push(String(firebaseUidFromToken));

    const User = mongoose.model('User');
    const resolveUserIdVariants = async (id) => {
      const out = new Set([String(id)]);
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          const byId = await User.findById(id).select('_id firebaseUid uid');
          if (byId?._id) out.add(String(byId._id));
          if (byId?.firebaseUid) out.add(String(byId.firebaseUid));
          if (byId?.uid) out.add(String(byId.uid));
        }

        const byAlt = await User.findOne({ $or: [{ firebaseUid: id }, { uid: id }] }).select('_id firebaseUid uid');
        if (byAlt?._id) out.add(String(byAlt._id));
        if (byAlt?.firebaseUid) out.add(String(byAlt.firebaseUid));
        if (byAlt?.uid) out.add(String(byAlt.uid));
      } catch {}
      return Array.from(out);
    };

    let convos = [];

    // If conversationId looks like "id1_id2", treat as pair key and merge legacy duplicates
    if (typeof conversationId === 'string' && conversationId.includes('_')) {
      const parts = conversationId.split('_');
      const a = parts[0];
      const b = parts[1];
      const aIds = await resolveUserIdVariants(a);
      const bIds = await resolveUserIdVariants(b);
      convos = await Conversation.find({
        $and: [
          { participants: { $in: aIds } },
          { participants: { $in: bIds } }
        ]
      }).sort({ lastMessageAt: -1 });
    } else {
      // Try to find by string ID first, then by MongoDB ObjectId
      const single = await Conversation.findOne({
        $or: [
          { conversationId: conversationId },
          { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
        ]
      });
      if (single) convos = [single];
    }

    if (!convos || convos.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Privacy: only participants can read (for all merged convos)
    const allowed = convos.some(c => {
      const participants = Array.isArray(c?.participants) ? c.participants.map(String) : [];
      return idsToMatch.some(id => participants.includes(String(id)));
    });

    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Merge messages across duplicate conversations
    const merged = [];
    const seen = new Set();
    for (const c of convos) {
      for (const m of (c?.messages || [])) {
        const mid = m?.id;
        if (typeof mid === 'string' && mid.length > 0) {
          if (seen.has(mid)) continue;
          seen.add(mid);
        }
        merged.push(m);
      }
    }

    merged.sort((m1, m2) => {
      const t1 = new Date(m1?.timestamp || 0).getTime() || 0;
      const t2 = new Date(m2?.timestamp || 0).getTime() || 0;
      return t1 - t2;
    });

    res.json({ success: true, messages: merged });
  } catch (err) {
    console.error('[GET] /:id/messages - Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark all messages as read for the authenticated user in a conversation
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const userIdFromToken = req.userId;
    const firebaseUidFromToken = req.user?.firebaseUid;
    const idsToMatch = [String(userIdFromToken)];
    if (firebaseUidFromToken) idsToMatch.push(String(firebaseUidFromToken));

    const User = mongoose.model('User');
    const resolveUserIdVariants = async (id) => {
      const out = new Set([String(id)]);
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          const byId = await User.findById(id).select('_id firebaseUid uid');
          if (byId?._id) out.add(String(byId._id));
          if (byId?.firebaseUid) out.add(String(byId.firebaseUid));
          if (byId?.uid) out.add(String(byId.uid));
        }

        const byAlt = await User.findOne({ $or: [{ firebaseUid: id }, { uid: id }] }).select('_id firebaseUid uid');
        if (byAlt?._id) out.add(String(byAlt._id));
        if (byAlt?.firebaseUid) out.add(String(byAlt.firebaseUid));
        if (byAlt?.uid) out.add(String(byAlt.uid));
      } catch {}
      return Array.from(out);
    };

    let convos = [];

    if (typeof conversationId === 'string' && conversationId.includes('_')) {
      const parts = conversationId.split('_');
      const a = parts[0];
      const b = parts[1];
      const aIds = await resolveUserIdVariants(a);
      const bIds = await resolveUserIdVariants(b);
      convos = await Conversation.find({
        $and: [
          { participants: { $in: aIds } },
          { participants: { $in: bIds } }
        ]
      }).sort({ lastMessageAt: -1 });
    } else {
      const single = await Conversation.findOne({
        $or: [
          { conversationId: conversationId },
          { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
        ]
      });

      // If we found a conversation, expand to all legacy duplicates for this participant pair
      if (single && Array.isArray(single?.participants) && single.participants.length === 2) {
        const p0 = String(single.participants[0]);
        const p1 = String(single.participants[1]);
        const p0Ids = await resolveUserIdVariants(p0);
        const p1Ids = await resolveUserIdVariants(p1);
        convos = await Conversation.find({
          $and: [
            { participants: { $in: p0Ids } },
            { participants: { $in: p1Ids } }
          ]
        }).sort({ lastMessageAt: -1 });
      } else if (single) {
        convos = [single];
      }
    }

    if (!convos || convos.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const allowed = convos.some(c => {
      const participants = Array.isArray(c?.participants) ? c.participants.map(String) : [];
      return idsToMatch.some(id => participants.includes(String(id)));
    });

    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    let markedCount = 0;
    for (const c of convos) {
      let changed = false;
      for (const m of (c?.messages || [])) {
        const recipientId = m?.recipientId != null ? String(m.recipientId) : '';
        const isForMe = recipientId && idsToMatch.some(id => String(id) === recipientId);
        if (isForMe && m?.read === false) {
          m.read = true;
          markedCount += 1;
          changed = true;
        }
      }
      if (changed) {
        c.updatedAt = new Date();
        await c.save();
      }
    }

    return res.json({ success: true, markedCount });
  } catch (err) {
    console.error('[PATCH] /:id/read - Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Send a message in a conversation (POST /:id/messages)
router.post('/:id/messages', verifyToken, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { senderId, sender, text, recipientId, replyTo, read } = req.body;
    
    // Sender must be the authenticated user
    const actualSenderId = String(req.userId || senderId || sender || '');
    if (!actualSenderId || !text) {
      return res.status(400).json({ success: false, error: 'Missing senderId and/or text' });
    }

    // Normalize recipientId to Mongo _id string where possible
    const User = mongoose.model('User');
    let normalizedRecipientId = recipientId ? String(recipientId) : null;
    if (normalizedRecipientId && !mongoose.Types.ObjectId.isValid(normalizedRecipientId)) {
      const found = await User.findOne({ $or: [{ firebaseUid: normalizedRecipientId }, { uid: normalizedRecipientId }] }).select('_id');
      if (found?._id) {
        normalizedRecipientId = String(found._id);
      }
    }

    if (!normalizedRecipientId) {
      return res.status(400).json({ success: false, error: 'Requires recipientId' });
    }

    // Also normalize sender if somehow a firebase uid was passed
    let normalizedSenderId = String(actualSenderId);
    if (!mongoose.Types.ObjectId.isValid(normalizedSenderId)) {
      const foundSender = await User.findOne({ $or: [{ firebaseUid: normalizedSenderId }, { uid: normalizedSenderId }] }).select('_id');
      if (foundSender?._id) {
        normalizedSenderId = String(foundSender._id);
      }
    }

    // Try to find by string ID first, then by MongoDB ObjectId, then by participants
    let convo = await Conversation.findOne({
      $or: [
        { conversationId: conversationId },
        { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null },
        // Also check by participants to avoid duplicates
        normalizedRecipientId ? { participants: { $all: [normalizedSenderId, normalizedRecipientId] } } : null
      ].filter(Boolean)
    });

    if (!convo) {
      console.log('[POST] /:id/messages - Conversation not found, creating new one:', conversationId);
      // Conversation doesn't exist yet, create it
      // Use actual IDs from request body to avoid parsing issues with underscores in user IDs
      const participants = [normalizedSenderId, normalizedRecipientId];

      if (participants.length < 2) {
        console.error('[POST] ERROR: Cannot create conversation without 2 participants! Got:', participants);
        return res.status(400).json({ success: false, error: 'Requires both senderId and recipientId' });
      }

      // Sort participants to ensure consistent conversationId
      const sortedParticipants = participants.sort();
      const standardConversationId = `${sortedParticipants[0]}_${sortedParticipants[1]}`;

      console.log('[POST] Creating conversation with participants:', sortedParticipants, 'conversationId:', standardConversationId);

      convo = new Conversation({
        conversationId: standardConversationId,
        participants: sortedParticipants
      });
    }
    
    // Initialize messages array if it doesn't exist
    if (!convo.messages) {
      convo.messages = [];
    }
    
    const message = { 
      senderId: normalizedSenderId, 
      text,
      read: read || false,
      timestamp: new Date()
    };
    
    // Add recipientId if provided
    message.recipientId = normalizedRecipientId;
    
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

    // Best-effort: create notification for recipient
    try {
      if (normalizedRecipientId && normalizedRecipientId !== normalizedSenderId) {
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        const senderUser = mongoose.Types.ObjectId.isValid(normalizedSenderId)
          ? await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(normalizedSenderId) })
          : null;
        const senderName = senderUser?.displayName || senderUser?.name || 'Someone';
        const senderAvatar = senderUser?.avatar || senderUser?.photoURL || null;

        const notificationsCollection = db.collection('notifications');
        const convId = String(convo.conversationId || conversationId);
        const now = new Date();

        // Dedupe: keep only one unread message notification per (recipient, sender, conversation)
        // If an unread one exists, update its timestamp + sender meta. Otherwise, insert a new one.
        await notificationsCollection.updateOne(
          {
            recipientId: String(normalizedRecipientId),
            senderId: String(normalizedSenderId),
            type: 'message',
            conversationId: convId,
            read: { $ne: true }
          },
          {
            $set: {
              senderName,
              senderAvatar,
              message: 'messaged you',
              createdAt: now
            },
            $setOnInsert: {
              recipientId: String(normalizedRecipientId),
              senderId: String(normalizedSenderId),
              type: 'message',
              conversationId: convId,
              read: false
            }
          },
          { upsert: true }
        );
      }
    } catch (e) {
      console.warn('[POST] /:id/messages - Notification skipped:', e.message);
    }

    console.log('[POST] /:id/messages - Message saved successfully!');
    console.log('[POST] Conversation state after save:', {
      conversationId: convo.conversationId,
      participants: convo.participants,
      messageCount: convo.messages?.length,
      lastMessage: convo.lastMessage
    });

    // Emit message to recipient via Socket.IO for real-time delivery
    try {
      const io = req.app.get('io');
      console.log('[Socket] IO instance available?', !!io);

      if (!io) {
        console.error('[Socket] ❌ IO instance not found on req.app');
      } else if (!normalizedRecipientId) {
        console.warn('[Socket] ⚠️ No recipientId provided, skipping emit');
      } else {
        // Use the actual conversationId from the saved conversation (not the route param)
        const actualConversationId = convo.conversationId;
        console.log('[Socket] 📡 Emitting newMessage to conversationId:', actualConversationId);
        console.log('[Socket] 📡 Message data:', {
          messageId: message.id,
          senderId: normalizedSenderId,
          recipientId: normalizedRecipientId,
          text: message.text?.substring(0, 30)
        });

        // Emit to conversation room (both users subscribed to this)
        io.to(actualConversationId).emit('newMessage', {
          ...message,
          conversationId: actualConversationId
        });
        console.log('[Socket] ✅ Emitted to conversation room:', actualConversationId);

        // Also emit to recipient's personal room
        io.to(`user_${normalizedRecipientId}`).emit('newMessage', {
          ...message,
          conversationId: actualConversationId
        });
        console.log('[Socket] ✅ Emitted to recipient room:', `user_${normalizedRecipientId}`);

        // Also emit to sender's personal room for multi-device sync
        io.to(`user_${normalizedSenderId}`).emit('newMessage', {
          ...message,
          conversationId: actualConversationId
        });
        console.log('[Socket] ✅ Emitted to sender room:', `user_${normalizedSenderId}`);

        console.log('[Socket] ✅✅✅ All emits complete!');
      }
    } catch (socketError) {
      console.error('[Socket] ❌ Error emitting message:', socketError);
      console.error('[Socket] ❌ Error stack:', socketError.stack);
      // Don't fail the request if socket emit fails
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error('[POST] /:id/messages - Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or create conversation
router.post('/get-or-create', verifyToken, async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    const User = mongoose.model('User');
    const normalizeToMongo = async (id) => {
      const raw = String(id || '');
      if (!raw) return null;
      if (mongoose.Types.ObjectId.isValid(raw)) return raw;
      const found = await User.findOne({ $or: [{ firebaseUid: raw }, { uid: raw }] }).select('_id');
      return found?._id ? String(found._id) : raw;
    };

    const a = await normalizeToMongo(userId1);
    const b = await normalizeToMongo(userId2);
    if (!a || !b) {
      return res.status(400).json({ success: false, error: 'userId1 and userId2 required' });
    }

    const ids = [a, b].map(String).sort();
    const conversationId = `${ids[0]}_${ids[1]}`;

    const matches = await Conversation.find({
      $or: [
        { conversationId: conversationId },
        { participants: { $all: ids } }
      ]
    }).sort({ lastMessageAt: -1 });

    let conversation = matches?.[0] || null;
    if (!conversation) {
      conversation = new Conversation({
        conversationId,
        participants: ids
      });
      await conversation.save();
    }

    res.json({ success: true, id: conversation._id, conversationId });
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

// PATCH /:conversationId/messages/:messageId - Edit message
router.patch('/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const { conversationId, messageId } = req.params;

    console.log('[PATCH] /:conversationId/messages/:messageId - Request:', {
      conversationId,
      messageId,
      userId,
      text: text?.substring(0, 30)
    });

    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'userId and text required' });
    }

    // Find conversation
    const conversation = await Conversation.findOne({
      $or: [
        { conversationId: conversationId },
        { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
      ]
    });

    if (!conversation) {
      console.log('[PATCH] Conversation not found:', conversationId);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Find message in conversation.messages array
    const message = conversation.messages?.find(m => m.id === messageId);
    if (!message) {
      console.log('[PATCH] Message not found in conversation:', messageId);
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Check authorization
    if (message.senderId !== userId) {
      console.log('[PATCH] Unauthorized - senderId:', message.senderId, 'userId:', userId);
      return res.status(403).json({ success: false, error: 'Unauthorized - you can only edit your own messages' });
    }

    // Update message
    message.text = text;
    message.editedAt = new Date();
    await conversation.save();

    console.log('[PATCH] Message updated:', messageId);
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('[PATCH] /:conversationId/messages/:messageId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:conversationId/messages/:messageId - Delete message
router.delete('/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const { userId } = req.body;
    const { conversationId, messageId } = req.params;

    console.log('[DELETE] /:conversationId/messages/:messageId - Request:', {
      conversationId,
      messageId,
      userId
    });

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    // Find conversation
    const conversation = await Conversation.findOne({
      $or: [
        { conversationId: conversationId },
        { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
      ]
    });

    if (!conversation) {
      console.log('[DELETE] Conversation not found:', conversationId);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Find message in conversation.messages array
    const message = conversation.messages?.find(m => m.id === messageId);
    if (!message) {
      console.log('[DELETE] Message not found in conversation:', messageId);
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Check authorization
    if (message.senderId !== userId) {
      console.log('[DELETE] Unauthorized - senderId:', message.senderId, 'userId:', userId);
      return res.status(403).json({ success: false, error: 'Unauthorized - you can only delete your own messages' });
    }

    // Remove message from array
    conversation.messages = conversation.messages.filter(m => m.id !== messageId);
    await conversation.save();

    console.log('[DELETE] Message deleted:', messageId);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    console.error('[DELETE] /:conversationId/messages/:messageId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:conversationId/messages/:messageId/reactions - React to message
router.post('/:conversationId/messages/:messageId/reactions', async (req, res) => {
  try {
    const { userId, reaction, emoji } = req.body;
    const { conversationId, messageId } = req.params;

    // Accept both 'reaction' and 'emoji' for compatibility
    const actualReaction = reaction || emoji;

    console.log('[POST] /:conversationId/messages/:messageId/reactions - Request:', {
      conversationId,
      messageId,
      userId,
      reaction: actualReaction
    });

    if (!userId || !actualReaction) {
      return res.status(400).json({ success: false, error: 'userId and reaction/emoji required' });
    }

    // Find conversation
    const conversation = await Conversation.findOne({
      $or: [
        { conversationId: conversationId },
        { _id: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null }
      ]
    });

    if (!conversation) {
      console.log('[POST] Conversation not found:', conversationId);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Find message in conversation.messages array
    const message = conversation.messages?.find(m => m.id === messageId);
    if (!message) {
      console.log('[POST] Message not found in conversation:', messageId);
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Initialize reactions object if not exists
    if (!message.reactions) {
      message.reactions = {};
    }

    // Initialize reaction array if not exists
    if (!message.reactions[actualReaction]) {
      message.reactions[actualReaction] = [];
    }

    // Toggle reaction (Instagram style - add if not present, remove if present)
    const userIndex = message.reactions[actualReaction].indexOf(userId);
    if (userIndex === -1) {
      message.reactions[actualReaction].push(userId);
      console.log('[POST] Added reaction:', actualReaction, 'from user:', userId);
    } else {
      message.reactions[actualReaction].splice(userIndex, 1);
      console.log('[POST] Removed reaction:', actualReaction, 'from user:', userId);

      // Remove empty reaction arrays
      if (message.reactions[actualReaction].length === 0) {
        delete message.reactions[actualReaction];
      }
    }

    // Mark as modified for Mongoose
    conversation.markModified('messages');
    await conversation.save();

    console.log('[POST] Reactions updated for message:', messageId);
    res.json({ success: true, data: { reactions: message.reactions } });
  } catch (err) {
    console.error('[POST] /:conversationId/messages/:messageId/reactions error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
