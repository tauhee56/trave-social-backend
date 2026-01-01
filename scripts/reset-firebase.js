#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.GCLOUD_KEY_FILE || 
  path.join(__dirname, '../serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = require(path.resolve(serviceAccountPath));
  console.log('✅ Firebase service account loaded from:', serviceAccountPath);
} catch (err) {
  console.error('❌ Error loading Firebase service account:', err.message);
  console.error('Tried path:', path.resolve(serviceAccountPath));
  console.error('Make sure GCLOUD_KEY_FILE env variable is set or serviceAccountKey.json exists');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function resetFirebase() {
  try {
    console.log('\n🔄 Resetting Firebase...\n');

    // 1. Delete all Firestore collections
    console.log('📦 Deleting Firestore collections...');
    const collections = [
      'users',
      'posts',
      'stories',
      'highlights',
      'sections',
      'messages',
      'conversations',
      'comments',
      'livestreams',
      'notifications',
      'follows',
      'savedPosts',
      'reports',
      'blocks',
      'analytics',
      'hashtags',
      'categories',
      'regions',
      'adminLogs',
      'passports',
      'presences'
    ];

    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        console.log(`  Deleting ${collectionName}: ${snapshot.size} documents...`);
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.size > 0) {
          await batch.commit();
          console.log(`  ✅ Cleared: ${collectionName}`);
        } else {
          console.log(`  ✓ ${collectionName} was already empty`);
        }
      } catch (err) {
        if (err.code === 'not-found') {
          console.log(`  ✓ ${collectionName} doesn't exist (skipped)`);
        } else {
          console.error(`  ❌ Error clearing ${collectionName}:`, err.message);
        }
      }
    }

    // 2. Delete all Firebase Authentication users
    console.log('\n👥 Deleting Firebase Authentication users...');
    try {
      let userCount = 0;
      let deletedCount = 0;
      
      const deleteUsers = async (nextPageToken) => {
        try {
          const result = await auth.listUsers(1000, nextPageToken);
          
          for (const userRecord of result.users) {
            try {
              await auth.deleteUser(userRecord.uid);
              deletedCount++;
              console.log(`  ✅ Deleted user: ${userRecord.email || userRecord.uid}`);
            } catch (err) {
              console.error(`  ❌ Error deleting user ${userRecord.uid}:`, err.message);
            }
          }
          
          userCount += result.users.length;
          
          // Recursively delete next batch
          if (result.pageToken) {
            await deleteUsers(result.pageToken);
          }
        } catch (err) {
          console.error('❌ Error listing users:', err.message);
        }
      };

      await deleteUsers();
      console.log(`\n✅ Deleted ${deletedCount} Firebase users`);

    } catch (err) {
      console.error('❌ Error deleting Firebase users:', err.message);
    }

    console.log('\n🎉 Firebase reset complete!');
    console.log('✅ All Firestore collections cleared');
    console.log('✅ All Authentication users deleted');
    console.log('\nFirebase is now completely empty and ready for fresh data!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting Firebase:', err.message);
    process.exit(1);
  }
}

resetFirebase();
