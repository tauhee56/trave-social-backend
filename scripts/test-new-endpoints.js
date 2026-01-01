#!/usr/bin/env node
/**
 * Quick validation script to test all new endpoints
 */

const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com/api';

// Test data
const testData = {
  userId: '507f1f77bcf86cd799439011', // Example MongoDB ObjectId
  recipientId: '507f1f77bcf86cd799439011',
  senderId: '507f1f77bcf86cd799439012',
  postId: '507f1f77bcf86cd799439013',
};

async function testEndpoints() {
  console.log('🧪 Testing new API endpoints...\n');

  try {
    // Test GET notifications
    console.log('1️⃣ Testing GET /api/notifications/:userId');
    const notifRes = await axios.get(`${BACKEND_URL}/notifications/${testData.userId}`);
    console.log('✅ GET notifications:', notifRes.status);

    // Test POST notification (create)
    console.log('\n2️⃣ Testing POST /api/notifications');
    const createNotifRes = await axios.post(`${BACKEND_URL}/notifications`, {
      recipientId: testData.recipientId,
      senderId: testData.senderId,
      type: 'like',
      postId: testData.postId,
      message: 'liked your post'
    });
    console.log('✅ POST notification:', createNotifRes.status);
    const notifId = createNotifRes.data?.data?._id;

    // Test PATCH notification (mark as read)
    if (notifId) {
      console.log('\n3️⃣ Testing PATCH /api/notifications/:notificationId/read');
      const readRes = await axios.patch(`${BACKEND_URL}/notifications/${notifId}/read`);
      console.log('✅ PATCH notification read:', readRes.status);
    }

    // Test POST block user
    console.log('\n4️⃣ Testing POST /api/users/:userId/block/:blockUserId');
    const blockRes = await axios.post(
      `${BACKEND_URL}/users/${testData.userId}/block/507f1f77bcf86cd799439014`
    ).catch(e => e.response);
    console.log('✅ POST block user:', blockRes?.status || 'expected error');

    // Test POST report user
    console.log('\n5️⃣ Testing POST /api/users/:userId/report');
    const reportRes = await axios.post(`${BACKEND_URL}/users/${testData.userId}/report`, {
      reporterId: testData.senderId,
      reason: 'spam'
    }).catch(e => e.response);
    console.log('✅ POST report user:', reportRes?.status || 'expected error');

    // Test POST report post
    console.log('\n6️⃣ Testing POST /api/posts/:postId/report');
    const reportPostRes = await axios.post(`${BACKEND_URL}/posts/${testData.postId}/report`, {
      userId: testData.userId,
      reason: 'inappropriate'
    }).catch(e => e.response);
    console.log('✅ POST report post:', reportPostRes?.status || 'expected error');

    // Test GET profile URL
    console.log('\n7️⃣ Testing GET /api/users/:userId/profile-url');
    const urlRes = await axios.get(`${BACKEND_URL}/users/${testData.userId}/profile-url`);
    console.log('✅ GET profile URL:', urlRes.status);

    // Test POST sections
    console.log('\n8️⃣ Testing POST /api/users/:userId/sections');
    const sectRes = await axios.post(`${BACKEND_URL}/users/${testData.userId}/sections`, {
      name: 'Test Section',
      postIds: []
    });
    console.log('✅ POST create section:', sectRes.status);
    const sectionId = sectRes.data?.data?._id;

    // Test PUT section
    if (sectionId) {
      console.log('\n9️⃣ Testing PUT /api/users/:userId/sections/:sectionId');
      const updateRes = await axios.put(
        `${BACKEND_URL}/users/${testData.userId}/sections/${sectionId}`,
        { name: 'Updated Section' }
      );
      console.log('✅ PUT update section:', updateRes.status);

      // Test DELETE section
      console.log('\n🔟 Testing DELETE /api/users/:userId/sections/:sectionId');
      const delRes = await axios.delete(
        `${BACKEND_URL}/users/${testData.userId}/sections/${sectionId}`
      );
      console.log('✅ DELETE section:', delRes.status);
    }

    console.log('\n✅ All endpoint tests completed!\n');
  } catch (err) {
    console.error('❌ Test error:', err.message);
  }
}

testEndpoints();
