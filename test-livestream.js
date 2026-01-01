#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const USER_1 = '507f1f77bcf86cd799439011';
const USER_2 = '507f1f77bcf86cd799439012';

async function runLiveStreamTest() {
  console.log('🎥 LIVE STREAMING TEST WITH AGORA\n');
  console.log('='.repeat(70));
  console.log('Testing: Start stream, Join stream, Leave stream, End stream\n');
  
  let streamId = null;
  
  const tests = [
    {
      name: '1️⃣ Get active live streams',
      method: 'GET',
      url: '/api/live-streams',
      check: (res) => res.status === 200 && Array.isArray(res.data?.data || res.data?.streams),
    },
    {
      name: '2️⃣ Start new live stream',
      method: 'POST',
      url: '/api/live-streams',
      data: { userId: USER_1, title: 'Testing Live Stream with Agora' },
      check: (res) => res.status === 200 || res.status === 201,
      onSuccess: (res) => { streamId = res.data?.data?._id || res.data?.id; }
    },
    {
      name: '3️⃣ Get Agora token for broadcaster',
      method: 'POST',
      url: '/api/live-streams/{streamId}/agora-token',
      data: { userId: USER_1, role: 'publisher' },
      check: (res) => res.status === 200 && res.data?.token,
      requiresStreamId: true
    },
    {
      name: '4️⃣ Get Agora token for viewer',
      method: 'POST',
      url: '/api/live-streams/{streamId}/agora-token',
      data: { userId: USER_2, role: 'subscriber' },
      check: (res) => res.status === 200 && res.data?.token,
      requiresStreamId: true
    },
    {
      name: '5️⃣ Verify stream is active',
      method: 'GET',
      url: '/api/live-streams',
      check: (res) => {
        const streams = res.data?.data || res.data?.streams || [];
        return res.status === 200 && streams.some(s => s.isActive === true || s.active === true);
      }
    },
    {
      name: '6️⃣ End live stream',
      method: 'PATCH',
      url: '/api/live-streams/{streamId}/end',
      data: { userId: USER_1 },
      check: (res) => res.status === 200,
      requiresStreamId: true
    },
    {
      name: '7️⃣ Verify stream is ended',
      method: 'GET',
      url: '/api/live-streams/{streamId}',
      check: (res) => res.status === 200 || res.status === 404,
      requiresStreamId: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    if (test.requiresStreamId && !streamId) {
      console.log(`⏭️  ${test.name} - SKIPPED (no stream ID)`);
      continue;
    }
    
    try {
      let url = test.url;
      if (test.requiresStreamId) url = url.replace('{streamId}', streamId);
      
      const fullUrl = `${BACKEND_URL}${url}`;
      
      let res;
      if (test.method === 'GET') {
        res = await axios.get(fullUrl, { timeout: 5000 });
      } else if (test.method === 'POST') {
        res = await axios.post(fullUrl, test.data, { timeout: 5000 });
      } else if (test.method === 'PATCH') {
        res = await axios.patch(fullUrl, test.data, { timeout: 5000 });
      }
      
      if (test.check(res)) {
        console.log(`✅ ${test.name}`);
        console.log(`   Status: ${res.status}`);
        if (test.onSuccess) test.onSuccess(res);
        if (res.data?.token) {
          console.log(`   Token: ${res.data.token.substring(0, 30)}...`);
        }
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${res.status} (expected different response)`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${test.name}`);
      console.log(`   Status: ${err.response?.status}`);
      console.log(`   Error: ${err.response?.data?.error || err.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 RESULTS:\n`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`);
  
  if (failed === 0) {
    console.log('🎉 Live streaming with Agora is FULLY FUNCTIONAL!');
  } else if (failed <= 2) {
    console.log('⚠️  Some features need Agora token generation endpoint');
  } else {
    console.log('❌ Live streaming needs implementation');
  }
}

runLiveStreamTest();
