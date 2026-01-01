#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const USER_1 = '507f1f77bcf86cd799439011';
const USER_2 = '507f1f77bcf86cd799439012';

async function runMessagingTest() {
  console.log('💬 COMPREHENSIVE MESSAGING SYSTEM TEST\n');
  console.log('='.repeat(70));
  console.log('Testing: Send, Edit, Delete, React, Reply messages like Instagram\n');
  
  let conversationId = null;
  let messageId = null;
  let replyId = null;
  
  const tests = [
    {
      name: '1️⃣ Create conversation between users',
      method: 'POST',
      url: '/api/conversations/get-or-create',
      data: { userId1: USER_1, userId2: USER_2 },
      check: (res) => res.status === 200,
      onSuccess: (res) => { conversationId = res.data?.id; }
    },
    {
      name: '2️⃣ Send first message',
      method: 'POST',
      url: '/api/conversations/{conversationId}/messages',
      data: { senderId: USER_1, text: 'Hello! How are you?' },
      check: (res) => res.status === 201 || res.status === 200,
      requiresConvId: true,
      onSuccess: (res) => { messageId = res.data?.id; }
    },
    {
      name: '3️⃣ Send second message',
      method: 'POST',
      url: '/api/conversations/{conversationId}/messages',
      data: { senderId: USER_2, text: 'Im doing great! How about you?' },
      check: (res) => res.status === 201 || res.status === 200,
      requiresConvId: true,
      onSuccess: (res) => { replyId = res.data?.id; }
    },
    {
      name: '4️⃣ Get all messages in conversation',
      method: 'GET',
      url: '/api/conversations/{conversationId}/messages',
      check: (res) => res.status === 200 && Array.isArray(res.data?.data),
      requiresConvId: true
    },
    {
      name: '5️⃣ Edit own message',
      method: 'PATCH',
      url: '/api/conversations/{conversationId}/messages/{messageId}',
      data: { userId: USER_1, text: 'Hello! How are you doing?' },
      check: (res) => res.status === 200,
      requiresConvId: true,
      requiresMessageId: true
    },
    {
      name: '6️⃣ React to message',
      method: 'POST',
      url: '/api/conversations/{conversationId}/messages/{messageId}/reactions',
      data: { userId: USER_2, reaction: 'love' },
      check: (res) => res.status === 200 || res.status === 201,
      requiresConvId: true,
      requiresMessageId: true
    },
    {
      name: '7️⃣ Add another reaction to message',
      method: 'POST',
      url: '/api/conversations/{conversationId}/messages/{messageId}/reactions',
      data: { userId: USER_1, reaction: 'haha' },
      check: (res) => res.status === 200 || res.status === 201,
      requiresConvId: true,
      requiresMessageId: true
    },
    {
      name: '8️⃣ Reply to message',
      method: 'POST',
      url: '/api/conversations/{conversationId}/messages/{messageId}/replies',
      data: { senderId: USER_1, text: 'I was actually about to ask you that!' },
      check: (res) => res.status === 201 || res.status === 200,
      requiresConvId: true,
      requiresMessageId: true,
      onSuccess: (res) => { replyId = res.data?.id; }
    },
    {
      name: '9️⃣ Get message with reactions and replies',
      method: 'GET',
      url: '/api/conversations/{conversationId}/messages/{messageId}',
      check: (res) => res.status === 200,
      requiresConvId: true,
      requiresMessageId: true
    },
    {
      name: '🔟 Delete own message',
      method: 'DELETE',
      url: '/api/conversations/{conversationId}/messages/{messageId}',
      data: { userId: USER_1 },
      check: (res) => res.status === 200,
      requiresConvId: true,
      requiresMessageId: true
    },
    {
      name: '1️⃣1️⃣ Try delete someone elses message (should fail)',
      method: 'DELETE',
      url: '/api/conversations/{conversationId}/messages/{replyId}',
      data: { userId: USER_1 },
      check: (res) => res.status === 403 || res.status === 400,
      requiresConvId: true,
      requiresReplyId: true,
      expectFailure: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    if (test.requiresConvId && !conversationId) {
      console.log(`⏭️  ${test.name} - SKIPPED (no conversation ID)`);
      continue;
    }
    
    if (test.requiresMessageId && !messageId) {
      console.log(`⏭️  ${test.name} - SKIPPED (no message ID)`);
      continue;
    }
    
    if (test.requiresReplyId && !replyId) {
      console.log(`⏭️  ${test.name} - SKIPPED (no reply ID)`);
      continue;
    }
    
    try {
      let url = test.url;
      if (test.requiresConvId) url = url.replace('{conversationId}', conversationId);
      if (test.requiresMessageId) url = url.replace('{messageId}', messageId);
      if (test.requiresReplyId) url = url.replace('{replyId}', replyId);
      
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
        console.log(`   Status: ${res.status} (expected different response)`);
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
    console.log('🎉 Messaging system is FULLY FUNCTIONAL!');
  } else {
    console.log('⚠️  Some messaging features need implementation');
  }
}

runMessagingTest();
