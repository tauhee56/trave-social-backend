#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testImageUpload() {
  try {
    console.log('\n🧪 Testing Image Upload to Backend...\n');

    // Create a larger, more valid test image (10x10 red pixel PNG in base64)
    const testImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

    // Test 1: Upload to backend
    console.log('📤 Test 1: Uploading image to backend...');
    const uploadRes = await axios.post(
      'https://trave-social-backend.onrender.com/api/media/upload',
      {
        image: testImageBase64,
        path: 'test-images'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Backend response:', uploadRes.status, uploadRes.data);

    if (uploadRes.data?.data?.url) {
      console.log('✅ Image URL:', uploadRes.data.data.url);
      
      // Check if it's a Cloudinary URL or fallback
      if (uploadRes.data.data.url.includes('cloudinary')) {
        console.log('\n✅✅ SUCCESS: Image uploaded to Cloudinary!');
      } else if (uploadRes.data.data.url.includes('placeholder')) {
        console.log('\n⚠️ Image URL is placeholder - Cloudinary may have failed');
      }
    } else {
      console.error('❌ No URL in response');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.response?.data) {
      console.error('Response:', err.response.data);
    }
    process.exit(1);
  }
}

testImageUpload();
