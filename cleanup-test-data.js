require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trave-social';

async function cleanupTestData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Collections to check and clean
    const collections = ['posts', 'comments', 'livestreams', 'livestream_comments', 'messages', 'conversations', 'users'];

    for (const collection of collections) {
      try {
        const col = db.collection(collection);
        const count = await col.countDocuments();
        console.log(`\n📊 Collection: ${collection} - ${count} documents`);

        // Show sample documents
        const samples = await col.find({}).limit(2).toArray();
        console.log('Sample documents:');
        samples.forEach((doc, i) => {
          const preview = JSON.stringify(doc).substring(0, 120);
          console.log(`  ${i + 1}. ${preview}...`);
        });
      } catch (err) {
        console.log(`⚠️ Collection ${collection} not found or error`);
      }
    }

    console.log('\n\n=== CLEANUP OPTIONS ===');
    console.log('1. Delete all test/dummy data');
    console.log('2. Delete all data and start fresh');
    console.log('3. Cancel');

    // For now, show what would be deleted
    console.log('\n✅ Database inspection complete');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupTestData();
