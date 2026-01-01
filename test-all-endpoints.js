#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_USER_ID_2 = '507f1f77bcf86cd799439012';

async function runFullEndpointTests() {
  console.log('🧪 Testing All New Backend Endpoints\n');
  
  const tests = [
    {
      name: 'GET /api/users/:userId',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}`,
      expectedStatus: 200
    },
    {
      name: 'GET /api/notifications/:userId',
      method: 'GET',
      url: `/api/notifications/${TEST_USER_ID}`,
      expectedStatus: 200
    },
    {
      name: 'POST /api/notifications',
      method: 'POST',
      url: '/api/notifications',
      data: {
        recipientId: TEST_USER_ID,
        senderId: TEST_USER_ID_2,
        type: 'like',
        message: 'Liked your post'
      },
      expectedStatus: 201
    },
    {
      name: 'GET /api/users/:userId/sections',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/sections`,
      expectedStatus: 200
    },
    {
      name: 'POST /api/users/:userId/sections',
      method: 'POST',
      url: `/api/users/${TEST_USER_ID}/sections`,
      data: {
        name: 'Test Section'
      },
      expectedStatus: 201
    },
    {
      name: 'POST /api/users/:userId/block/:blockUserId',
      method: 'POST',
      url: `/api/users/${TEST_USER_ID}/block/${TEST_USER_ID_2}`,
      expectedStatus: 201
    },
    {
      name: 'GET /api/users/:userId/profile-url',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/profile-url`,
      expectedStatus: 200
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const config = { timeout: 10000, validateStatus: () => true };
      let res;

      if (test.method === 'GET') {
        res = await axios.get(`${BACKEND_URL}${test.url}`, config);
      } else if (test.method === 'POST') {
        res = await axios.post(`${BACKEND_URL}${test.url}`, test.data, config);
      } else if (test.method === 'PUT') {
        res = await axios.put(`${BACKEND_URL}${test.url}`, test.data, config);
      }

      if (res.status === test.expectedStatus || (res.status >= 200 && res.status < 300)) {
        console.log(`✅ ${test.name}`);
        console.log(`   Status: ${res.status}`);
        if (res.data?.success) console.log(`   Response: OK`);
        passed++;
      } else if (res.status === 404) {
        console.log(`❌ ${test.name} - Endpoint not found (404)`);
        failed++;
      } else {
        console.log(`⚠️ ${test.name}`);
        console.log(`   Status: ${res.status}`);
        console.log(`   Error: ${res.data?.error}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${test.name} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  
  if (failed === 0) {
    console.log('\n🎉 All endpoints are working!');
  }
}

runFullEndpointTests().catch(console.error);
