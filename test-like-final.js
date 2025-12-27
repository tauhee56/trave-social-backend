const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    // Set default headers
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
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`Request error: ${err.code}`);
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
    
    if (postsRes.status !== 200) {
      console.log('   Response:', JSON.stringify(postsRes.data, null, 2));
      console.log('❌ API returned error');
      process.exit(1);
    }
    
    if (!postsRes.data.success || !postsRes.data.data || postsRes.data.data.length === 0) {
      console.log('   No posts found in database');
      process.exit(1);
    }
    
    const postId = postsRes.data.data[0]._id;
    console.log(`   ✅ Found ${postsRes.data.data.length} posts`);
    console.log(`   Using: ${postId}\n`);
    
    const userId = '5WLYAqbq2phJqbJUj6El20zD9fC3';
    console.log(`2. Using user: ${userId}\n`);
    
    // Like post
    console.log('3. Liking post...');
    const likeRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'POST'
    }, { userId });
    
    if (likeRes.status === 200 && likeRes.data.success) {
      console.log(`   ✅ Liked successfully`);
      console.log(`   Likes: ${likeRes.data.data.likesCount}\n`);
    } else {
      console.log(`   ❌ Failed: ${likeRes.status}`);
      console.log('   Response:', JSON.stringify(likeRes.data, null, 2));
    }
    
    console.log('✅ Test complete!');
    process.exit(0);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

test();
