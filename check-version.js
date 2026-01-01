#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';

async function checkBackendVersion() {
  console.log('🔍 Checking Backend Version and Status...\n');

  try {
    // Try to call root endpoint to see if we get diagnostic info
    const res = await axios.get(`${BACKEND_URL}/`, { timeout: 10000 });
    console.log('✅ Backend is running');
    console.log('Response:', res.data);
  } catch (err) {
    console.log('Response:', err.response?.data);
  }

  console.log('\n📋 Testing specific error case...');
  try {
    // Call the notifications endpoint that's failing
    const res = await axios.get(`${BACKEND_URL}/api/notifications/507f1f77bcf86cd799439011`, { 
      timeout: 10000,
      validateStatus: () => true // Accept any status
    });
    
    console.log('Status:', res.status);
    console.log('Response:', res.data);
    
    // If we get error about toObjectId, it means old code
    if (res.data?.error?.includes('toObjectId is not a constructor')) {
      console.log('\n❌ OLD CODE is running on Render!');
      console.log('   The server is running the version BEFORE the toObjectId helper was added');
      console.log('   Expected commit: d782c5a');
      console.log('   Action: Render needs to redeploy or is in cold-start');
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
}

checkBackendVersion().catch(console.error);
