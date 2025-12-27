const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    if (!options.headers) options.headers = {};
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  try {
    console.log('🧪 Comprehensive Like/Unlike Test\n');
    
    // Get first post
    const postsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/posts',
      method: 'GET'
    });
    
    const postId = postsRes.data.data[0]._id;
    const user1 = 'user-1-id';
    const user2 = 'user-2-id';
    
    console.log(`Using post: ${postId}\n`);
    
    // Step 1: Get initial likes
    console.log('1️⃣ Getting initial post state...');
    const getRes1 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}`,
      method: 'GET'
    });
    const initialLikes = getRes1.data.data.likesCount || 0;
    console.log(`   Initial likes: ${initialLikes}\n`);
    
    // Step 2: User 1 likes
    console.log('2️⃣ User 1 liking post...');
    const likeRes1 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'POST'
    }, { userId: user1 });
    console.log(`   ✅ Likes: ${likeRes1.data.data.likesCount}\n`);
    
    // Step 3: User 2 likes
    console.log('3️⃣ User 2 liking post...');
    const likeRes2 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'POST'
    }, { userId: user2 });
    console.log(`   ✅ Likes: ${likeRes2.data.data.likesCount}\n`);
    
    // Step 4: User 1 unlikes
    console.log('4️⃣ User 1 unliking post...');
    const unlikeRes1 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'DELETE'
    }, { userId: user1 });
    console.log(`   ✅ Likes: ${unlikeRes1.data.data.likesCount}\n`);
    
    // Step 5: Verify final state
    console.log('5️⃣ Verifying final state...');
    const getRes2 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}`,
      method: 'GET'
    });
    const finalLikes = getRes2.data.data.likesCount;
    const likesByUser = getRes2.data.data.likes || [];
    
    console.log(`   Final likes: ${finalLikes}`);
    console.log(`   Liked by: ${likesByUser.join(', ')}\n`);
    
    // Verify
    if (finalLikes === initialLikes + 1 && likesByUser.includes(user2) && !likesByUser.includes(user1)) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('   - Like/Unlike working correctly');
      console.log('   - User tracking accurate');
      console.log('   - Counter increments/decrements properly');
    } else {
      console.log('❌ Test failed - state mismatch');
    }
    
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
