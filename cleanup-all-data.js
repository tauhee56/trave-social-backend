#!/usr/bin/env node

/**
 * Database Cleanup Script
 * Removes test/dummy data from MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI not found in .env file');
  console.error('Please set MONGODB_URI environment variable');
  process.exit(1);
}

console.log('🔗 Connecting to MongoDB...');
console.log(`📍 Database: ${MONGODB_URI.split('/').pop()}`);

async function cleanupAllData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Collections to clean
    const collections = [
      'posts',
      'comments',
      'livestreams',
      'livestream_comments',
      'messages',
      'conversations',
      'stories',
      'highlights',
      'notifications'
    ];

    console.log('📊 DELETING TEST DATA FROM COLLECTIONS:\n');

    let totalDeleted = 0;

    for (const collectionName of collections) {
      try {
        const col = db.collection(collectionName);
        const count = await col.countDocuments();
        
        if (count > 0) {
          const result = await col.deleteMany({});
          console.log(`  ✅ ${collectionName}: ${result.deletedCount} documents deleted (was ${count})`);
          totalDeleted += result.deletedCount;
        } else {
          console.log(`  ℹ️  ${collectionName}: empty (0 documents)`);
        }
      } catch (err) {
        console.log(`  ⚠️  ${collectionName}: not found or error`);
      }
    }

    console.log(`\n✅ Total documents deleted: ${totalDeleted}\n`);
    console.log('🧹 Database cleanup complete!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Ask for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: This will DELETE ALL data from the database!\n');

rl.question('Are you sure you want to proceed? (type "yes" to confirm): ', (answer) => {
  rl.close();

  if (answer.toLowerCase() === 'yes') {
    console.log('\n🗑️  Starting cleanup...\n');
    cleanupAllData();
  } else {
    console.log('\n❌ Cleanup cancelled');
    process.exit(0);
  }
});
