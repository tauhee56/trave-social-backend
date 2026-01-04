require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupDuplicateConversations() {
  // Connect to MongoDB
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ MongoDB connected');

  try {
    const db = mongoose.connection.db;
    const conversationsCollection = db.collection('conversations');
    
    console.log('\n🔍 Finding duplicate conversations...\n');
    
    // Get all conversations
    const allConversations = await conversationsCollection.find({}).toArray();
    console.log(`Total conversations: ${allConversations.length}`);
    
    // Group by participants (sorted)
    const conversationGroups = new Map();
    
    allConversations.forEach(conv => {
      if (!conv.participants || conv.participants.length !== 2) {
        console.log(`⚠️ Skipping invalid conversation: ${conv._id}`);
        return;
      }
      
      // Create a unique key from sorted participants
      const key = [...conv.participants].sort().join('_');
      
      if (!conversationGroups.has(key)) {
        conversationGroups.set(key, []);
      }
      
      conversationGroups.get(key).push(conv);
    });
    
    console.log(`\n📊 Found ${conversationGroups.size} unique participant pairs\n`);
    
    // Find and merge duplicates
    let deletedCount = 0;
    let mergedCount = 0;
    
    for (const [key, conversations] of conversationGroups.entries()) {
      if (conversations.length > 1) {
        console.log(`\n🔄 Found ${conversations.length} duplicates for: ${key}`);
        
        // Sort by most recent activity
        conversations.sort((a, b) => {
          const dateA = a.updatedAt || a.createdAt || new Date(0);
          const dateB = b.updatedAt || b.createdAt || new Date(0);
          return new Date(dateB) - new Date(dateA);
        });
        
        // Keep the first one (most recent), merge messages from others
        const keepConversation = conversations[0];
        const deleteConversations = conversations.slice(1);
        
        console.log(`  ✅ Keeping: ${keepConversation._id} (${keepConversation.messages?.length || 0} messages)`);
        
        // Merge all messages into the kept conversation
        const allMessages = [...(keepConversation.messages || [])];
        
        for (const dupConv of deleteConversations) {
          console.log(`  ❌ Deleting: ${dupConv._id} (${dupConv.messages?.length || 0} messages)`);
          
          // Add messages from duplicate
          if (dupConv.messages && dupConv.messages.length > 0) {
            allMessages.push(...dupConv.messages);
          }
          
          // Delete duplicate
          await conversationsCollection.deleteOne({ _id: dupConv._id });
          deletedCount++;
        }
        
        // Remove duplicate messages (by id)
        const uniqueMessages = [];
        const seenIds = new Set();
        
        for (const msg of allMessages) {
          if (!seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            uniqueMessages.push(msg);
          }
        }
        
        // Sort messages by timestamp
        uniqueMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Update kept conversation with merged messages
        const lastMessage = uniqueMessages[uniqueMessages.length - 1];
        await conversationsCollection.updateOne(
          { _id: keepConversation._id },
          {
            $set: {
              messages: uniqueMessages,
              lastMessage: lastMessage?.text || keepConversation.lastMessage,
              lastMessageAt: lastMessage?.timestamp || keepConversation.lastMessageAt,
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`  ✅ Merged ${allMessages.length} → ${uniqueMessages.length} unique messages`);
        mergedCount++;
      }
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Deleted ${deletedCount} duplicate conversations`);
    console.log(`   - Merged ${mergedCount} conversation groups`);
    
    // Show final state
    const finalConversations = await conversationsCollection.find({}).toArray();
    console.log(`\n📊 Final state: ${finalConversations.length} conversations`);
    
    finalConversations.forEach((conv, i) => {
      console.log(`  [${i}] ${conv.participants.join(' ↔ ')} | ${conv.messages?.length || 0} messages | last: "${conv.lastMessage?.substring(0, 30)}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run cleanup
cleanupDuplicateConversations();

