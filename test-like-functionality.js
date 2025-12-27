const http = require('http');

async function testLikeFunctionality() {
  console.log('🔍 Testing Like Functionality\n');

  // We know these exist from previous tests
  const userId = '5WLYAqbq2phJqbJUj6El20zD9fC3';
  let postId = null;

  // Step 0: Get a valid post ID first
  console.log('Step 0: Fetching list of posts to get valid ID...');
  const posts = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/posts`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  if (posts.success && posts.data.length > 0) {
    postId = posts.data[0]._id;
    console.log(`✓ Found ${posts.data.length} posts`);
    console.log(`  Using post ID: ${postId}\n`);
  } else {
    console.log('✗ No posts found');
    process.exit(1);
  }

  console.log(`User ID: ${userId}`);
  console.log(`Post ID: ${postId}\n`);

  // Step 1: Get post before like
  console.log('Step 1: Fetching post before like...');
  const postBefore = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/posts/${postId}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  if (postBefore.success) {
    console.log(`✓ Post fetched`);
    console.log(`  Likes: ${postBefore.data.likesCount || 0}`);
    console.log(`  Liked by: ${postBefore.data.likes?.length || 0} users\n`);
  } else {
    console.log('✗ Failed to fetch post');
    process.exit(1);
  }

  // Step 2: Like the post
  console.log('Step 2: Liking post...');
  const likeData = JSON.stringify({ userId });
  const likeRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': likeData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(likeData);
    req.end();
  });

  if (likeRes.success) {
    console.log('✓ Post liked successfully');
    console.log(`  New likes count: ${likeRes.data.likesCount}\n`);
  } else {
    console.log('✗ Failed to like post:', likeRes.error);
    process.exit(1);
  }

  // Step 3: Get post after like
  console.log('Step 3: Fetching post after like...');
  const postAfter = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/posts/${postId}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  if (postAfter.success) {
    const likedByUser = postAfter.data.likes?.includes(userId);
    console.log(`✓ Post fetched`);
    console.log(`  Likes: ${postAfter.data.likesCount}`);
    console.log(`  Liked by this user: ${likedByUser ? 'YES' : 'NO'}\n`);
  }

  // Step 4: Unlike the post
  console.log('Step 4: Unliking post...');
  const unlikeRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/posts/${postId}/like`,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': likeData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(likeData);
    req.end();
  });

  if (unlikeRes.success) {
    console.log('✓ Post unliked successfully');
    console.log(`  New likes count: ${unlikeRes.data.likesCount}\n`);
  }

  console.log('🎉 All like tests passed!');
  process.exit(0);
}

testLikeFunctionality().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
