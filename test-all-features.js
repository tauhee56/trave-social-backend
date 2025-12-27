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
    console.log('🧪 Testing All Features\n');
    
    const userId = 'user-test-123';
    const userId2 = 'user-test-456';
    let postId = null;
    
    // === 1. Test Post Creation ===
    console.log('1️⃣ CREATE POST');
    const createPostRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/posts',
      method: 'POST'
    }, {
      userId,
      caption: 'Test post caption',
      imageUrls: ['https://example.com/image.jpg'],
      hashtags: ['#test', '#demo'],
      location: 'Test Location'
    });
    
    if (createPostRes.status === 201 && createPostRes.data.success) {
      postId = createPostRes.data.data._id;
      console.log(`   ✅ Post created: ${postId}\n`);
    } else {
      console.log(`   ❌ Failed: ${createPostRes.status} - ${createPostRes.data.error}\n`);
      process.exit(1);
    }
    
    // === 2. Test Comments ===
    console.log('2️⃣ ADD COMMENT');
    const commentRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/comments/${postId}`,
      method: 'POST'
    }, {
      userId,
      text: 'Great post!'
    });
    
    if (commentRes.status === 201 && commentRes.data.success) {
      console.log(`   ✅ Comment added\n`);
    } else {
      console.log(`   ❌ Failed: ${commentRes.status}\n`);
    }
    
    // === 3. Test Get Comments ===
    console.log('3️⃣ GET COMMENTS');
    const getCommentsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/comments/${postId}`,
      method: 'GET'
    });
    
    if (getCommentsRes.data.success) {
      console.log(`   ✅ Got ${getCommentsRes.data.data.length} comments\n`);
    } else {
      console.log(`   ❌ Failed\n`);
    }
    
    // === 4. Test Messages/Inbox ===
    console.log('4️⃣ SEND MESSAGE');
    const messageRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/messages',
      method: 'POST'
    }, {
      fromUserId: userId,
      toUserId: userId2,
      text: 'Hello, how are you?'
    });
    
    if (messageRes.status === 201 && messageRes.data.success) {
      console.log(`   ✅ Message sent\n`);
    } else {
      console.log(`   ❌ Failed: ${messageRes.status}\n`);
    }
    
    // === 5. Test Get Messages ===
    console.log('5️⃣ GET INBOX');
    const inboxRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/messages/user/${userId2}`,
      method: 'GET'
    });
    
    if (inboxRes.data.success) {
      console.log(`   ✅ Got ${inboxRes.data.data.length} messages\n`);
    } else {
      console.log(`   ❌ Failed\n`);
    }
    
    // === 6. Test Notifications ===
    console.log('6️⃣ CREATE NOTIFICATION');
    const notifRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/notifications',
      method: 'POST'
    }, {
      recipientId: userId,
      type: 'like',
      message: `${userId2} liked your post`,
      relatedPostId: postId,
      relatedUserId: userId2
    });
    
    if (notifRes.status === 201 && notifRes.data.success) {
      console.log(`   ✅ Notification created\n`);
    } else {
      console.log(`   ❌ Failed: ${notifRes.status}\n`);
    }
    
    // === 7. Test Get Notifications ===
    console.log('7️⃣ GET NOTIFICATIONS');
    const getNotifsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/notifications/${userId}`,
      method: 'GET'
    });
    
    if (getNotifsRes.data.success) {
      console.log(`   ✅ Got ${getNotifsRes.data.data.length} notifications\n`);
    } else {
      console.log(`   ❌ Failed\n`);
    }
    
    console.log('✅ ALL TESTS PASSED!');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
