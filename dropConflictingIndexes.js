const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster.mongodb.net/travesocial?retryWrites=true&w=majority';

async function dropConflictingIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // List all indexes
    const indexes = await usersCollection.listIndexes().toArray();
    console.log('\nCurrent indexes:');
    indexes.forEach(idx => {
      console.log(`- ${JSON.stringify(idx)}`);
    });

    // Drop all indexes except _id_
    console.log('\nDropping conflicting indexes...');
    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await usersCollection.dropIndex(index.name);
          console.log(`✓ Dropped index: ${index.name}`);
        } catch (err) {
          console.log(`✗ Could not drop ${index.name}: ${err.message}`);
        }
      }
    }

    // Create correct indexes
    console.log('\nCreating correct indexes...');
    
    // Unique index on email with sparse option
    await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('✓ Created unique index on email (sparse)');

    // Index on firebaseUid (no unique constraint, sparse to allow multiple nulls)
    await usersCollection.createIndex({ firebaseUid: 1 }, { sparse: true });
    console.log('✓ Created index on firebaseUid (sparse)');

    // Verify indexes
    const newIndexes = await usersCollection.listIndexes().toArray();
    console.log('\nFinal indexes:');
    newIndexes.forEach(idx => {
      console.log(`- ${JSON.stringify(idx)}`);
    });

    console.log('\n✓ Index cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

dropConflictingIndexes();
