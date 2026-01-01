#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const TEST_USER_ID = '507f1f77bcf86cd799439011';

async function runTests() {
  console.log('🔍 Testing Backend Endpoints...\n');

  // Test 1: Root endpoint
  try {
    const res = await axios.get(`${BACKEND_URL}/`, { timeout: 10000 });
    console.log('✅ GET / - Success');
  } catch (err) {
    console.log('❌ GET / - Error:', err.message);
  }

  // Test 2: Users endpoint
  try {
    const res = await axios.get(`${BACKEND_URL}/api/users/${TEST_USER_ID}`, { timeout: 10000 });
    console.log('✅ GET /api/users/:userId - Success');
  } catch (err) {
    console.log('❌ GET /api/users/:userId - Error:', err.message);
    if (err.response?.data) {
      console.log('   Response:', JSON.stringify(err.response.data, null, 2));
    }
  }

  // Test 3: Notifications endpoint
  try {
    const res = await axios.get(`${BACKEND_URL}/api/notifications/${TEST_USER_ID}`, { timeout: 10000 });
    console.log('✅ GET /api/notifications/:userId - Success');
    console.log('   Data:', res.data);
  } catch (err) {
    console.log('❌ GET /api/notifications/:userId - Error:', err.message);
    if (err.response?.data) {
      console.log('   Response:', JSON.stringify(err.response.data, null, 2));
    }
    if (err.response?.status) {
      console.log('   Status:', err.response.status);
    }
  }

  // Test 4: Check if toObjectId function exists by calling endpoint
  console.log('\n📋 Checking if Render has latest code (commit d782c5a)...');
  try {
    const res = await axios.get(`${BACKEND_URL}/api/notifications/${TEST_USER_ID}`, { timeout: 10000 });
    console.log('✅ Latest code appears to be deployed');
  } catch (err) {
    if (err.message.includes('toObjectId is not a constructor')) {
      console.log('❌ Old code still running (pre-fix version)');
    } else if (err.response?.status === 500) {
      console.log('⚠️ 500 error - checking error type...');
      console.log('   Error:', err.response?.data?.error || 'Unknown');
    }
  }
}

runTests().catch(console.error);
