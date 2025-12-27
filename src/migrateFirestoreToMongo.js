// Firestore to MongoDB migration script
// Usage: node src/migrateFirestoreToMongo.js

const admin = require('firebase-admin');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

// --- Setup ---
admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey.json')),
});
const firestore = admin.firestore();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gcs = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEY_FILE || '../serviceAccountKey.json',
});

async function uploadGsFileToCloudinary(gsUrl) {
  // gs://bucket/path/to/file
  const match = gsUrl.match(/^gs:\/\/(.+?)\/(.+)$/);
  if (!match) {
    console.log('Not a gs:// URL:', gsUrl);
    return gsUrl;
  }
  const bucketName = match[1];
  const filePath = match[2];
  const tempFile = `./tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    console.log(`Downloading from Firebase Storage: bucket=${bucketName}, file=${filePath}`);
    await gcs.bucket(bucketName).file(filePath).download({ destination: tempFile });
    console.log(`Uploading to Cloudinary: ${tempFile}`);
    const result = await cloudinary.uploader.upload(tempFile);
    fs.unlinkSync(tempFile);
    console.log(`Cloudinary upload success: ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    console.error('Cloudinary upload failed for', gsUrl, err.message);
    return gsUrl;
  }
}

// --- Example: Migrate users ---
async function migrateUsers() {
  const usersSnapshot = await firestore.collection('users').get();
  const User = mongoose.model('User', new mongoose.Schema({ _id: String }, { strict: false }));
  let count = 0;
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    // If user has avatar in Firebase Storage, upload to Cloudinary
    if (data.avatarUrl && data.avatarUrl.startsWith('gs://')) {
      // TODO: Download from Firebase Storage and upload to Cloudinary
      // For now, just copy the URL
      data.avatarUrl = data.avatarUrl;
    }
    await User.updateOne({ _id: doc.id }, data, { upsert: true });
    count++;
  }
  console.log(`Migrated ${count} users.`);
}

// --- Example: Migrate posts ---
async function migratePosts() {
  const postsSnapshot = await firestore.collection('posts').get();
  const Post = mongoose.model('Post', new mongoose.Schema({ _id: String }, { strict: false }));
  let count = 0;
  for (const doc of postsSnapshot.docs) {
    const data = doc.data();
    // If post has media in Firebase Storage, upload to Cloudinary
    if (Array.isArray(data.mediaUrls)) {
      data.mediaUrls = data.mediaUrls.map(url => {
        if (url.startsWith('gs://')) {
          // TODO: Download from Firebase Storage and upload to Cloudinary
          return url;
        }
        return url;
      });
    }
    await Post.updateOne({ _id: doc.id }, data, { upsert: true });
    count++;
  }
  console.log(`Migrated ${count} posts.`);
}

// --- Main ---


async function replaceGsUrls(obj) {
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map(item => replaceGsUrls(item)));
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      obj[key] = await replaceGsUrls(obj[key]);
    }
    return obj;
  } else if (typeof obj === 'string' && obj.startsWith('gs://')) {
    return await uploadGsFileToCloudinary(obj);
  } else {
    return obj;
  }
}

async function migrateAllCollections() {
  const collections = await firestore.listCollections();
  for (const collectionRef of collections) {
    const name = collectionRef.id;
    const snapshot = await collectionRef.get();
    const Model = mongoose.model(name.charAt(0).toUpperCase() + name.slice(1), new mongoose.Schema({ _id: String }, { strict: false }));
    let count = 0;
    for (const doc of snapshot.docs) {
      let data = doc.data();
      data = await replaceGsUrls(data);
      await Model.updateOne({ _id: doc.id }, data, { upsert: true });
      count++;
    }
    console.log(`Migrated ${count} documents from collection: ${name}`);
  }
}

async function main() {
  try {
    console.log('--- Firestore to MongoDB Migration Started ---');
    await migrateAllCollections();
    console.log('--- Migration Complete ---');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n--- Migration Failed ---');
    if (err && err.message) {
      console.error('Error:', err.message);
    } else {
      console.error('Error:', err);
    }
    process.exit(1);
  }
}

main();
