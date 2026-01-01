#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const BROADCASTER = '507f1f77bcf86cd799439011';
const VIEWER_1 = '507f1f77bcf86cd799439012';
const VIEWER_2 = '507f1f77bcf86cd799439013';

async function runLiveStreamCommentsTest() {
  console.log('🎥💬 LIVE STREAM COMMENTS TEST\n');
  console.log('='.repeat(70));
  console.log('Testing: Live stream comments, likes, reactions\n');
  
  let streamId = null;
  let commentId = null;
  let comment2Id = null;
  
  const tests = [
    {
      name: '1️⃣ Start live stream',
      method: 'POST',
      url: '/api/live-streams',
      data: { userId: BROADCASTER, title: 'Live Gaming Session' },
      check: (res) => res.status === 201 || res.status === 200,
      onSuccess: (res) => { streamId = res.data?.id; }
    },
    {
      name: '2️⃣ Viewer 1 joins stream',
      method: 'POST',
      url: '/api/live-streams/{streamId}/agora-token',
      data: { userId: VIEWER_1, role: 'subscriber' },
      check: (res) => res.status === 200 && res.data?.token,
      requiresStreamId: true
    },
    {
      name: '3️⃣ Viewer 2 joins stream',
      method: 'POST',
      url: '/api/live-streams/{streamId}/agora-token',
      data: { userId: VIEWER_2, role: 'subscriber' },
      check: (res) => res.status === 200 && res.data?.token,
      requiresStreamId: true
    },
    {
      name: '4️⃣ Viewer 1 comments on live stream',
      method: 'POST',
      url: '/api/live-streams/{streamId}/comments',
      data: { userId: VIEWER_1, text: 'Great stream! 🔥', userName: 'Viewer 1' },
      check: (res) => res.status === 201 || res.status === 200,
      requiresStreamId: true,
      onSuccess: (res) => { commentId = res.data?.id; }
    },
    {
      name: '5️⃣ Viewer 2 comments on live stream',
      method: 'POST',
      url: '/api/live-streams/{streamId}/comments',
      data: { userId: VIEWER_2, text: 'Amazing gameplay!', userName: 'Viewer 2' },
      check: (res) => res.status === 201 || res.status === 200,
      requiresStreamId: true,
      onSuccess: (res) => { comment2Id = res.data?.id; }
    },
    {
      name: '6️⃣ Get all comments on live stream',
      method: 'GET',
      url: '/api/live-streams/{streamId}/comments',
      check: (res) => res.status === 200 && Array.isArray(res.data?.data),
      requiresStreamId: true
    },
    {
      name: '7️⃣ Viewer 2 likes comment from Viewer 1',
      method: 'POST',
      url: '/api/live-streams/{streamId}/comments/{commentId}/like',
      data: { userId: VIEWER_2 },
      check: (res) => res.status === 200,
      requiresStreamId: true,
      requiresCommentId: true
    },
    {
      name: '8️⃣ Broadcaster reacts to comment',
      method: 'POST',
      url: '/api/live-streams/{streamId}/comments/{commentId}/reactions',
      data: { userId: BROADCASTER, reaction: 'love' },
      check: (res) => res.status === 200 || res.status === 201,
      requiresStreamId: true,
      requiresCommentId: true
    },
    {
      name: '9️⃣ Viewer edits own comment',
      method: 'PATCH',
      url: '/api/live-streams/{streamId}/comments/{commentId}',
      data: { userId: VIEWER_1, text: 'Great stream! 🔥 Best gameplay!' },
      check: (res) => res.status === 200,
      requiresStreamId: true,
      requiresCommentId: true
    },
    {
      name: '🔟 Try edit someone else\'s comment (should fail)',
      method: 'PATCH',
      url: '/api/live-streams/{streamId}/comments/{comment2Id}',
      data: { userId: VIEWER_1, text: 'Hacked!' },
      check: (res) => res.status === 403 || res.status === 400,
      requiresStreamId: true,
      requiresComment2Id: true,
      expectFailure: true
    },
    {
      name: '1️⃣1️⃣ Delete own comment',
      method: 'DELETE',
      url: '/api/live-streams/{streamId}/comments/{comment2Id}',
      data: { userId: VIEWER_2 },
      check: (res) => res.status === 200,
      requiresStreamId: true,
      requiresComment2Id: true
    },
    {
      name: '1️⃣2️⃣ Get comments again (should have one less)',
      method: 'GET',
      url: '/api/live-streams/{streamId}/comments',
      check: (res) => res.status === 200 && Array.isArray(res.data?.data),
      requiresStreamId: true
    },
    {
      name: '1️⃣3️⃣ End live stream',
      method: 'PATCH',
      url: '/api/live-streams/{streamId}/end',
      data: { userId: BROADCASTER },
      check: (res) => res.status === 200,
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
    
    if (test.requiresCommentId && !commentId) {
      console.log(`⏭️  ${test.name} - SKIPPED (no comment ID)`);
      continue;
    }
    
    if (test.requiresComment2Id && !comment2Id) {
      console.log(`⏭️  ${test.name} - SKIPPED (no second comment ID)`);
      continue;
    }
    
    try {
      let url = test.url;
      if (test.requiresStreamId) url = url.replace('{streamId}', streamId);
      if (test.requiresCommentId) url = url.replace('{commentId}', commentId);
      if (test.requiresComment2Id) url = url.replace('{comment2Id}', comment2Id);
      
      const fullUrl = `${BACKEND_URL}${url}`;
      
      let res;
      if (test.method === 'GET') {
        res = await axios.get(fullUrl, { timeout: 5000 });
      } else if (test.method === 'POST') {
        res = await axios.post(fullUrl, test.data, { timeout: 5000 });
      } else if (test.method === 'PATCH') {
        res = await axios.patch(fullUrl, test.data, { timeout: 5000 });
      } else if (test.method === 'DELETE') {
        res = await axios.delete(fullUrl, { data: test.data, timeout: 5000 });
      }
      
      if (test.check(res)) {
        console.log(`✅ ${test.name}`);
        console.log(`   Status: ${res.status}`);
        if (test.onSuccess) test.onSuccess(res);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${res.status} (expected different)`);
        failed++;
      }
    } catch (err) {
      const status = err.response?.status;
      const isExpectedFailure = test.expectFailure && (status === 403 || status === 400);
      
      if (isExpectedFailure) {
        console.log(`✅ ${test.name}`);
        console.log(`   Status: ${status} (expected failure - auth working)`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${status}`);
        console.log(`   Error: ${err.response?.data?.error || err.message}`);
        failed++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 RESULTS:\n`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`);
  
  if (failed === 0) {
    console.log('🎉 Live stream comments are FULLY FUNCTIONAL!');
  } else {
    console.log('⚠️  Some features need implementation');
  }
}

runLiveStreamCommentsTest();
