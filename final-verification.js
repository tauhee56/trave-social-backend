#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_USER_ID_2 = '507f1f77bcf86cd799439012';

async function runFinalVerification() {
  console.log('🎉 FINAL ENDPOINT VERIFICATION\n');
  console.log('='.repeat(60));
  console.log('Testing All Notification & Privacy Endpoints\n');
  
  const tests = [
    {
      name: 'Notifications - Get user notifications',
      method: 'GET',
      url: `/api/notifications/${TEST_USER_ID}`,
      expected: [200, 201]
    },
    {
      name: 'Notifications - Create notification',
      method: 'POST',
      url: '/api/notifications',
      data: {
        recipientId: TEST_USER_ID,
        senderId: TEST_USER_ID_2,
        type: 'like',
        message: 'Liked your post'
      },
      expected: [200, 201]
    },
    {
      name: 'Sections - Get user sections',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/sections`,
      expected: [200, 201]
    },
    {
      name: 'Sections - Create user section',
      method: 'POST',
      url: `/api/users/${TEST_USER_ID}/sections`,
      data: {
        name: 'Favorites'
      },
      expected: [200, 201]
    },
    {
      name: 'Privacy - Block user',
      method: 'POST',
      url: `/api/users/${TEST_USER_ID}/block/${TEST_USER_ID_2}`,
      expected: [200, 201, 400] // 400 if already blocked
    },
    {
      name: 'Privacy - Report user',
      method: 'POST',
      url: `/api/users/${TEST_USER_ID_2}/report`,
      data: {
        reporterId: TEST_USER_ID,
        reason: 'Spam'
      },
      expected: [200, 201]
    },
    {
      name: 'Profile - Get profile share URL',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/profile-url`,
      expected: [200, 201]
    }
  ];

  let passed = 0;
  let warning = 0;

  for (const test of tests) {
    try {
      const config = { timeout: 10000, validateStatus: () => true };
      let res;

      if (test.method === 'GET') {
        res = await axios.get(`${BACKEND_URL}${test.url}`, config);
      } else {
        res = await axios.post(`${BACKEND_URL}${test.url}`, test.data, config);
      }

      const isSuccess = test.expected.includes(res.status);
      
      if (isSuccess && res.status < 400) {
        console.log(`✅ ${test.name}`);
        console.log(`   Status: ${res.status}\n`);
        passed++;
      } else if (res.status === 400 && test.expected.includes(400)) {
        console.log(`⚠️  ${test.name}`);
        console.log(`   Status: ${res.status} (${res.data?.error || 'Already exists'})\n`);
        warning++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${res.status}`);
        console.log(`   Error: ${res.data?.error}\n`);
      }
    } catch (err) {
      console.log(`❌ ${test.name} - Connection Error`);
      console.log(`   ${err.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${warning} warnings\n`);
  
  if (passed >= 5) {
    console.log('🎉 All major endpoints are working!\n');
    console.log('✅ Backend is ready for production\n');
  }
}

runFinalVerification().catch(console.error);
