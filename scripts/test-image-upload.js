#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testImageUpload() {
  try {
    console.log('\n🧪 Testing Image Upload to Backend...\n');

    // Create a simple test image (1x1 red pixel PNG in base64)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

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
      console.log('\n✅ Image upload is working correctly!');
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
