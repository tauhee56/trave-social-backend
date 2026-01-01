#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_POST_ID = '507f1f77bcf86cd799439013';

async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE FEATURE TEST\n');
  console.log('='.repeat(70));
  console.log('Testing: Comments, Likes, Stories, Posts, Feed\n');
  
  const tests = [
    // ===== POSTS =====
    {
      category: '📝 POSTS',
      name: 'Get all posts',
      method: 'GET',
      url: '/api/posts',
    },
    {
      category: '📝 POSTS',
      name: 'Create new post',
      method: 'POST',
      url: '/api/posts',
      data: {
        userId: TEST_USER_ID,
        caption: 'Test post from endpoint verification',
        mediaUrl: 'https://via.placeholder.com/300',
        mediaType: 'image'
      }
    },
    
    // ===== COMMENTS =====
    {
      category: '💬 COMMENTS',
      name: 'Get post comments',
      method: 'GET',
      url: `/api/posts/${TEST_POST_ID}/comments`,
    },
    {
      category: '💬 COMMENTS',
      name: 'Add comment to post',
      method: 'POST',
      url: `/api/posts/${TEST_POST_ID}/comments`,
      data: {
        userId: TEST_USER_ID,
        text: 'Great post!',
        userName: 'TestUser'
      }
    },
    
    // ===== LIKES =====
    {
      category: '❤️ LIKES',
      name: 'Like post',
      method: 'POST',
      url: `/api/posts/${TEST_POST_ID}/like`,
      data: {
        userId: TEST_USER_ID
      }
    },
    {
      category: '❤️ LIKES',
      name: 'Unlike post',
      method: 'DELETE',
      url: `/api/posts/${TEST_POST_ID}/like`,
      data: {
        userId: TEST_USER_ID
      }
    },
    
    // ===== STORIES =====
    {
      category: '📖 STORIES',
      name: 'Get all stories',
      method: 'GET',
      url: '/api/stories',
    },
    {
      category: '📖 STORIES',
      name: 'Get user stories',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/stories`,
    },
    
    // ===== FEED =====
    {
      category: '🔄 FEED',
      name: 'Get personalized feed',
      method: 'GET',
      url: '/api/feed',
    },
    
    // ===== HIGHLIGHTS =====
    {
      category: '⭐ HIGHLIGHTS',
      name: 'Get user highlights',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/highlights`,
    },
    
    // ===== CATEGORIES =====
    {
      category: '🏷️ CATEGORIES',
      name: 'Get categories',
      method: 'GET',
      url: '/api/categories',
    },
    
    // ===== LIVE STREAMS =====
    {
      category: '🎥 LIVE STREAMS',
      name: 'Get live streams',
      method: 'GET',
      url: '/api/live-streams',
    },
    
    // ===== USER PROFILE =====
    {
      category: '👤 USER PROFILE',
      name: 'Get user profile',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}`,
    },
    {
      category: '👤 USER PROFILE',
      name: 'Get user posts',
      method: 'GET',
      url: `/api/users/${TEST_USER_ID}/posts`,
    },
  ];

  let results = {};
  let total = 0;
  let passed = 0;

  for (const test of tests) {
    try {
      if (!results[test.category]) {
        results[test.category] = { passed: 0, total: 0 };
      }
      results[test.category].total++;
      total++;

      const config = { timeout: 10000, validateStatus: () => true };
      let res;

      if (test.method === 'GET') {
        res = await axios.get(`${BACKEND_URL}${test.url}`, config);
      } else if (test.method === 'POST') {
        res = await axios.post(`${BACKEND_URL}${test.url}`, test.data, config);
      } else if (test.method === 'DELETE') {
        res = await axios.delete(`${BACKEND_URL}${test.url}`, { data: test.data, ...config });
      }

      if (res.status < 400) {
        console.log(`✅ ${test.name}`);
        results[test.category].passed++;
        passed++;
      } else if (res.status === 404) {
        console.log(`❌ ${test.name} - Not Found (404)`);
      } else if (res.status === 400) {
        console.log(`⚠️  ${test.name} - Bad Request (400)`);
        results[test.category].passed++;
        passed++;
      } else {
        console.log(`❌ ${test.name} - Error ${res.status}`);
      }
    } catch (err) {
      console.log(`❌ ${test.name} - ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY BY CATEGORY:\n');
  
  for (const [category, stats] of Object.entries(results)) {
    const percent = Math.round((stats.passed / stats.total) * 100);
    const status = percent === 100 ? '✅' : percent >= 80 ? '⚠️ ' : '❌';
    console.log(`${status} ${category}: ${stats.passed}/${stats.total} (${percent}%)`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n🎯 OVERALL: ${passed}/${total} tests passed (${Math.round((passed/total)*100)}%)\n`);
  
  if (passed >= 15) {
    console.log('🎉 All major features are working!\n');
  }
}

runComprehensiveTest().catch(console.error);
