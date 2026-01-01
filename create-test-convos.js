require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ ERROR: MONGO_URI not found');
  process.exit(1);
}

async function createTestConversations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Create test users
    const testUserId1 = new ObjectId('67467daa8ac0844f3eb20e14');
    const testUserId2 = new ObjectId('507f1f77bcf86cd799439011');
    const testUserId3 = new ObjectId('507f1f77bcf86cd799439012');

    // Create test conversation
    const conversation = {
      _id: new ObjectId(),
      userId1: testUserId1.toString(),
      userId2: testUserId2.toString(),
      participants: [testUserId1.toString(), testUserId2.toString()],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessage: 'Hey how are you?',
      lastMessageTime: new Date()
    };

    const result = await db.collection('conversations').insertOne(conversation);
    console.log('✅ Created test conversation:', result.insertedId);

    // Create test messages
    const messages = [
      {
        _id: new ObjectId(),
        conversationId: result.insertedId,
        senderId: testUserId1.toString(),
        text: 'Hey how are you?',
        createdAt: new Date()
      },
      {
        _id: new ObjectId(),
        conversationId: result.insertedId,
        senderId: testUserId2.toString(),
        text: 'I am good, how about you?',
        createdAt: new Date()
      }
    ];

    await db.collection('messages').insertMany(messages);
    console.log('✅ Created test messages');

    // Verify
    const convCount = await db.collection('conversations').countDocuments();
    const msgCount = await db.collection('messages').countDocuments();
    
    console.log(`\n📊 Database state:`);
    console.log(`  Conversations: ${convCount}`);
    console.log(`  Messages: ${msgCount}`);

    // Test the API query
    console.log(`\n🔍 Testing query for userId: ${testUserId1.toString()}`);
    const convos = await db.collection('conversations').find({
      $or: [
        { userId1: testUserId1.toString() },
        { userId2: testUserId1.toString() },
        { participants: testUserId1.toString() }
      ]
    }).toArray();
    
    console.log(`  Found: ${convos.length} conversations`);
    if (convos.length > 0) {
      console.log('  Sample:', JSON.stringify(convos[0], null, 2));
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestConversations();
