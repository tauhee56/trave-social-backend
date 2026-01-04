const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb+srv://trave:gQvF9jGIjY0lLkKR@cluster0.zq2rw.mongodb.net/trave?retryWrites=true&w=majority&appName=Cluster0';

async function testDatabase() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const usersCollection = db.collection('users');
    
    // Get a user
    const user = await usersCollection.findOne({});
    console.log('\n📝 Sample User:', user ? `${user._id} - ${user.username}` : 'No users found');
    
    // Get a post
    const post = await postsCollection.findOne({});
    console.log('📝 Sample Post:', post ? `${post._id} - savedBy: ${JSON.stringify(post.savedBy)}` : 'No posts found');
    
    // Check posts with saves
    const postsWithSaves = await postsCollection.find({ savedBy: { $exists: true } }).limit(5).toArray();
    console.log(`\n💾 Posts with savedBy field (${postsWithSaves.length}):`);
    postsWithSaves.forEach(p => {
      console.log(`  - Post ${p._id}`);
      console.log(`    - savedBy: ${JSON.stringify(p.savedBy)}`);
      console.log(`    - savesCount: ${p.savesCount}`);
    });
    
    console.log('\n✅ Test complete');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testDatabase();
