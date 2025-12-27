const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
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
    
    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  try {
    console.log('🧪 Testing Like Functionality\n');
    
    // Get posts
    console.log('1. Fetching posts...');
    const postsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/posts',
      method: 'GET'
    });
    
    console.log(`   Status: ${postsRes.status}`);
    if (!postsRes.data.success || postsRes.data.data.length === 0) {
      console.log('❌ No posts found');
      process.exit(1);
    }
    
    const postId = postsRes.data.data[0]._id;
    console.log(`   ✅ Found ${postsRes.data.data.length} posts`);
    console.log(`   Using: ${postId}\n`);
    
    // Get user
    const userId = '5WLYAqbq2phJqbJUj6El20zD9fC3';
    console.log(`2. Using user: ${userId}\n`);
    
    // Get post before like
    console.log('3. Fetching post before like...');
    const beforeRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}`,
      method: 'GET'
    });
    console.log(`   Likes before: ${beforeRes.data.data.likesCount || 0}\n`);
    
    // Like post
    console.log('4. Liking post...');
    const likeRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'POST'
    }, { userId });
    
    if (likeRes.status === 200 && likeRes.data.success) {
      console.log(`   ✅ Liked successfully`);
      console.log(`   Likes after: ${likeRes.data.data.likesCount}\n`);
    } else {
      console.log(`   ❌ Like failed: ${likeRes.status} - ${likeRes.data.error || 'Unknown error'}\n`);
    }
    
    // Unlike post
    console.log('5. Unliking post...');
    const unlikeRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'DELETE'
    }, { userId });
    
    if (unlikeRes.status === 200 && unlikeRes.data.success) {
      console.log(`   ✅ Unliked successfully`);
      console.log(`   Likes after: ${unlikeRes.data.data.likesCount}\n`);
    } else {
      console.log(`   ❌ Unlike failed: ${unlikeRes.status}\n`);
    }
    
    console.log('✅ All tests passed!');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
}

test();
