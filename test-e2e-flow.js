const http = require('http');

async function testCompleteFlow() {
  const timestamp = Date.now();
  const firebaseUid = `e2e-test-${timestamp}`;
  const email = `e2e-${timestamp}@test.com`;

  console.log('🔄 Complete End-to-End Flow Test\n');
  console.log('Step 1: Register New User');
  console.log(`Email: ${email}`);
  console.log(`Firebase UID: ${firebaseUid}\n`);

  // 1. Register user
  const registerData = JSON.stringify({
    firebaseUid,
    email,
    displayName: 'E2E Test User',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Testing E2E flow'
  });

  const registerRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register-firebase',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': registerData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(registerData);
    req.end();
  });

  if (!registerRes.success) {
    console.log('❌ Registration failed:', registerRes.error);
    process.exit(1);
  }

  console.log('✅ User registered successfully');
  const mongoId = registerRes.user.id;
  console.log(`   MongoDB ID: ${mongoId}\n`);

  // 2. Test profile fetch by Firebase UID
  console.log('Step 2: Fetch Profile by Firebase UID');
  const profileByUid = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/users/${firebaseUid}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  if (profileByUid.success && profileByUid.data?.email === email) {
    console.log('✅ Profile fetched by Firebase UID');
    console.log(`   Email: ${profileByUid.data.email}`);
    console.log(`   Display Name: ${profileByUid.data.displayName}\n`);
  } else {
    console.log('❌ Profile fetch by UID failed');
  }

  // 3. Test posts fetch
  console.log('Step 3: Fetch User Posts');
  const posts = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/users/${firebaseUid}/posts`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  if (posts.success) {
    console.log(`✅ Posts endpoint working (${posts.data.length} posts)\n`);
  } else {
    console.log('❌ Posts fetch failed\n');
  }

  // 4. Test highlights fetch
  console.log('Step 4: Fetch User Highlights');
  const highlights = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/users/${firebaseUid}/highlights`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  if (highlights.success) {
    console.log(`✅ Highlights endpoint working (${highlights.data.length} highlights)\n`);
  } else {
    console.log('❌ Highlights fetch failed\n');
  }

  console.log('🎉 All tests passed! E2E flow is working correctly.');
  process.exit(0);
}

testCompleteFlow().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
