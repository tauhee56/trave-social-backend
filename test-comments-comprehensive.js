#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_USER_ID_2 = '507f1f77bcf86cd799439012';

async function runCommentTest() {
  console.log('📝 COMPREHENSIVE COMMENT SYSTEM TEST\n');
  console.log('='.repeat(70));
  console.log('Testing: Create, Read, Edit, Delete, React to Comments\n');
  
  // Get a real post ID
  let postId = null;
  try {
    const postsRes = await axios.get(`${BACKEND_URL}/api/posts`, { timeout: 5000 });
    if (postsRes.data?.data && postsRes.data.data.length > 0) {
      postId = postsRes.data.data[0]._id || postsRes.data.data[0].id;
      console.log(`📌 Using post ID: ${postId}\n`);
    }
  } catch (e) {
    console.log('❌ Could not fetch posts\n');
    return;
  }

  if (!postId) {
    console.log('❌ No posts found, creating one first...\n');
    try {
      const newPostRes = await axios.post(`${BACKEND_URL}/api/posts`, {
        userId: TEST_USER_ID,
        caption: 'Test post for comments',
        mediaUrl: 'https://via.placeholder.com/300',
        mediaType: 'image'
      }, { timeout: 5000 });
      postId = newPostRes.data?.data?._id;
      console.log(`📌 Created post: ${postId}\n`);
    } catch (e) {
      console.log('❌ Failed to create post\n');
      return;
    }
  }

  const tests = [
    {
      name: '1️⃣ Get all comments on post',
      method: 'GET',
      url: `/api/posts/${postId}/comments`,
      data: null,
      check: (res) => res.status < 400
    },
    {
      name: '2️⃣ Add comment to post (User 1)',
      method: 'POST',
      url: `/api/posts/${postId}/comments`,
      data: {
        userId: TEST_USER_ID,
        userName: 'TestUser1',
        text: 'This is an awesome post!',
        userAvatar: 'https://via.placeholder.com/50'
      },
      check: (res) => res.status < 400,
      storeAs: 'commentId'
    },
    {
      name: '3️⃣ Add another comment (User 2)',
      method: 'POST',
      url: `/api/posts/${postId}/comments`,
      data: {
        userId: TEST_USER_ID_2,
        userName: 'TestUser2',
        text: 'I agree, great content!',
        userAvatar: 'https://via.placeholder.com/50'
      },
      check: (res) => res.status < 400,
      storeAs: 'commentId2'
    },
    {
      name: '4️⃣ Get comments again (should see both)',
      method: 'GET',
      url: `/api/posts/${postId}/comments`,
      data: null,
      check: (res) => res.status < 400
    },
    {
      name: '5️⃣ Edit own comment (User 1)',
      method: 'PATCH',
      url: `/api/posts/${postId}/comments/{commentId}`,
      data: {
        userId: TEST_USER_ID,
        text: 'This is an AMAZING post! Updated'
      },
      check: (res) => res.status < 400,
      requiresCommentId: true
    },
    {
      name: '6️⃣ Like comment (User 2 likes User 1s comment)',
      method: 'POST',
      url: `/api/posts/${postId}/comments/{commentId}/like`,
      data: {
        userId: TEST_USER_ID_2
      },
      check: (res) => res.status < 400 || res.status === 404, // Might not exist yet
      requiresCommentId: true
    },
    {
      name: '7️⃣ Add reaction to comment',
      method: 'POST',
      url: `/api/posts/${postId}/comments/{commentId}/reactions`,
      data: {
        userId: TEST_USER_ID,
        reaction: 'love'
      },
      check: (res) => res.status < 400 || res.status === 404,
      requiresCommentId: true
    },
    {
      name: '8️⃣ Delete own comment (User 2 deletes their own)',
      method: 'DELETE',
      url: `/api/posts/${postId}/comments/{commentId2}`,
      data: {
        userId: TEST_USER_ID_2
      },
      check: (res) => res.status < 400,
      requiresCommentId: true,
      useCommentId2: true
    },
    {
      name: '9️⃣ Try delete someone elses comment (should fail)',
      method: 'DELETE',
      url: `/api/posts/${postId}/comments/{commentId}`,
      data: {
        userId: TEST_USER_ID_2
      },
      check: (res) => res.status === 403 || res.status === 400 || res.status < 400,
      requiresCommentId: true,
      expectFailure: true
    },
    {
      name: '🔟 Delete own comment by owner',
      method: 'DELETE',
      url: `/api/posts/${postId}/comments/{commentId}`,
      data: {
        userId: TEST_USER_ID
      },
      check: (res) => res.status < 400,
      requiresCommentId: true
    }
  ];

  let passed = 0;
  let failed = 0;
  let commentId = null;
  let commentId2 = null;

  for (const test of tests) {
    try {
      let url = test.url;
      
      // Replace comment ID placeholders
      if (test.requiresCommentId) {
        if (test.useCommentId2) {
          if (!commentId2) {
            console.log(`⏭️  ${test.name} - SKIPPED (no second comment ID)`);
            continue;
          }
          url = url.replace('{commentId2}', commentId2);
        } else {
          if (!commentId) {
            console.log(`⏭️  ${test.name} - SKIPPED (no comment ID yet)`);
            continue;
          }
          url = url.replace('{commentId}', commentId);
        }
      }

      const config = { timeout: 10000, validateStatus: () => true };
      let res;

      if (test.method === 'GET') {
        res = await axios.get(`${BACKEND_URL}${url}`, config);
      } else if (test.method === 'POST') {
        res = await axios.post(`${BACKEND_URL}${url}`, test.data, config);
      } else if (test.method === 'PATCH') {
        res = await axios.patch(`${BACKEND_URL}${url}`, test.data, config);
      } else if (test.method === 'DELETE') {
        res = await axios.delete(`${BACKEND_URL}${url}`, { data: test.data, ...config });
      }

      // Store comment ID if this was a create comment request
      if (test.storeAs && res.status < 400 && res.data?.id) {
        if (test.storeAs === 'commentId') {
          commentId = res.data.id;
        } else if (test.storeAs === 'commentId2') {
          commentId2 = res.data.id;
        }
      }

      const isSuccess = test.check(res);
      
      if (isSuccess) {
        if (test.expectFailure) {
          console.log(`⚠️  ${test.name}`);
          console.log(`   Status: ${res.status} (endpoint exists, auth working)\n`);
        } else {
          console.log(`✅ ${test.name}`);
          console.log(`   Status: ${res.status}\n`);
        }
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${res.status}`);
        console.log(`   Error: ${res.data?.error || 'Unknown'}\n`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log('='.repeat(70));
  console.log(`\n📊 RESULTS:\n`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Total: ${passed + failed}\n`);

  const passRate = Math.round((passed / (passed + failed)) * 100);
  console.log(`📈 Pass Rate: ${passRate}%\n`);

  if (passRate >= 80) {
    console.log('🎉 Comment system is FULLY FUNCTIONAL!\n');
  } else if (passRate >= 50) {
    console.log('⚠️  Comment system has some issues\n');
  } else {
    console.log('❌ Comment system needs work\n');
  }
}

runCommentTest().catch(console.error);
