#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';

async function checkStatus() {
  try {
    console.log('🔍 Checking Render deployment status...\n');
    
    // Simple health check
    const healthRes = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Server is running');
    console.log('Health check:', healthRes.status);
    
    // Check if new code is deployed by testing a simple endpoint
    const postsRes = await axios.get(`${BACKEND_URL}/api/posts?limit=1`, { timeout: 5000 });
    console.log('✅ Posts endpoint working:', postsRes.status);
    
    if (postsRes.data?.data?.length > 0) {
      const postId = postsRes.data.data[0]._id;
      console.log(`\n📝 Testing comment endpoint with post ID: ${postId}\n`);
      
      // Test GET comments (should work)
      try {
        const getRes = await axios.get(`${BACKEND_URL}/api/posts/${postId}/comments`, { timeout: 5000 });
        console.log('✅ GET /api/posts/:postId/comments:', getRes.status);
      } catch (err) {
        console.log('❌ GET /api/posts/:postId/comments:', err.response?.status, err.response?.data?.error);
      }
      
      // Test POST comment (should work with new code)
      try {
        const postRes = await axios.post(`${BACKEND_URL}/api/posts/${postId}/comments`, {
          userId: '507f1f77bcf86cd799439011',
          userName: 'Test User',
          userAvatar: 'https://via.placeholder.com/40',
          text: 'Test comment'
        }, { timeout: 5000 });
        console.log('✅ POST /api/posts/:postId/comments:', postRes.status);
        console.log('   Response:', postRes.data);
      } catch (err) {
        console.log('❌ POST /api/posts/:postId/comments:', err.response?.status);
        console.log('   Error:', err.response?.data?.error);
        if (err.response?.data?.error?.includes('post.comments.push')) {
          console.log('   ⚠️  Still running OLD code - Render hasn\'t redeployed yet');
        }
      }
    }
  } catch (err) {
    console.log('❌ Server not responding:', err.message);
    console.log('   Render may still be deploying...');
  }
}

checkStatus();
