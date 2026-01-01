#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function deleteAllCloudinaryImages() {
  try {
    console.log('🔄 Connecting to Cloudinary...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

    let deletedCount = 0;
    let hasMore = true;
    let nextCursor = null;

    while (hasMore) {
      console.log('\n📦 Fetching resources from Cloudinary...');
      
      const options = {
        max_results: 500,
        resource_type: 'image'
      };
      
      if (nextCursor) {
        options.next_cursor = nextCursor;
      }

      const result = await cloudinary.api.resources(options);
      
      console.log(`Found ${result.resources.length} resources`);

      // Delete each resource
      for (const resource of result.resources) {
        try {
          console.log(`Deleting: ${resource.public_id}`);
          await cloudinary.uploader.destroy(resource.public_id);
          deletedCount++;
          console.log(`✅ Deleted: ${resource.public_id}`);
        } catch (err) {
          console.error(`❌ Error deleting ${resource.public_id}:`, err.message);
        }
      }

      // Check if there are more resources
      if (result.next_cursor) {
        nextCursor = result.next_cursor;
      } else {
        hasMore = false;
      }
    }

    console.log('\n🎉 Cloudinary cleanup complete!');
    console.log(`✅ Total deleted: ${deletedCount} images`);
    console.log('Cloudinary is now completely empty!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error cleaning Cloudinary:', err.message);
    process.exit(1);
  }
}

deleteAllCloudinaryImages();
