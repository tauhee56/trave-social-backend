// Firebase Storage to Cloudinary migration script
// Usage: node src/migrateStorageToCloudinary.js

const { Storage } = require('@google-cloud/storage');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gcs = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEY_FILE || '../serviceAccountKey.json',
});

const BUCKET_NAME = process.env.GCLOUD_STORAGE_BUCKET;
const FOLDER_PREFIXES = [
  'avatars',
  'posts',
  'highlights',
  'logo',
  'regions',
  'stories',
  'default'
];

async function migrateAllFiles() {
  const bucket = gcs.bucket(BUCKET_NAME);
  let [files] = await bucket.getFiles();
  console.log('All files found in bucket:');
  files.forEach(f => console.log(f.name));
  if (FOLDER_PREFIXES.length > 0) {
    files = files.filter(file => FOLDER_PREFIXES.some(prefix => file.name.startsWith(prefix)));
    console.log('Filtered files for migration:');
    files.forEach(f => console.log(f.name));
  }
  const mapping = {};
  for (const file of files) {
    const tempFile = path.join(__dirname, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    try {
      console.log(`Downloading: gs://${BUCKET_NAME}/${file.name}`);
      await file.download({ destination: tempFile });
      // Preserve folder structure in Cloudinary by setting public_id
      const publicId = file.name.replace(/\.[^/.]+$/, ''); // Remove extension for public_id
      console.log(`Uploading to Cloudinary: ${tempFile} as ${publicId}`);
      const result = await cloudinary.uploader.upload(tempFile, { public_id: publicId });
      fs.unlinkSync(tempFile);
      mapping[`gs://${BUCKET_NAME}/${file.name}`] = result.secure_url;
      console.log(`Cloudinary upload success: ${result.secure_url}`);
    } catch (err) {
      console.error('Cloudinary upload failed for', file.name, err.message);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'storageToCloudinaryMapping.json'), JSON.stringify(mapping, null, 2));
  console.log('Migration complete. Mapping saved to storageToCloudinaryMapping.json');
}

migrateAllFiles();
