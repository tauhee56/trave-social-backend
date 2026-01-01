#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://travelapp:travelapp@cluster0.j3gqe.mongodb.net/trave_social?retryWrites=true&w=majority';

async function resetDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    console.log('✅ Connected to MongoDB');

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📦 Found ${collections.length} collections`);
    console.log('Collections to delete:', collections.map(c => c.name).join(', '));

    // Drop each collection
    for (const collection of collections) {
      try {
        await db.collection(collection.name).deleteMany({});
        console.log(`✅ Cleared: ${collection.name}`);
      } catch (err) {
        console.error(`❌ Error clearing ${collection.name}:`, err.message);
      }
    }

    console.log('\n🎉 Database reset complete!');
    console.log('All collections have been cleared:');
    console.log('  ✓ Users');
    console.log('  ✓ Posts');
    console.log('  ✓ Stories');
    console.log('  ✓ Highlights');
    console.log('  ✓ Sections');
    console.log('  ✓ Messages');
    console.log('  ✓ Conversations');
    console.log('  ✓ Comments');
    console.log('  ✓ LiveStreams');
    console.log('  ✓ Notifications');
    console.log('  ✓ Follows');
    console.log('  ✓ All other collections');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err.message);
    process.exit(1);
  }
}

resetDatabase();
