const http = require('http');

// First register a user, then fetch their profile
async function testUserProfile() {
  const timestamp = Date.now();
  const firebaseUid = `test-user-${timestamp}`;
  const email = `profile-test-${timestamp}@example.com`;

  // Step 1: Register user
  console.log('Step 1: Registering user...');
  const registerData = {
    firebaseUid,
    email,
    displayName: 'Profile Test User',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'This is a test bio'
  };

  const registerPostData = JSON.stringify(registerData);
  const registerOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register-firebase',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerPostData)
    }
  };

  const registerResponse = await new Promise((resolve, reject) => {
    const req = http.request(registerOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(registerPostData);
    req.end();
  });

  console.log('✓ User registered:', registerResponse);
  const mongoId = registerResponse.user.id;

  // Step 2: Fetch profile using MongoDB ID
  console.log('\nStep 2: Fetching profile using MongoDB ObjectId...');
  const profileByMongoId = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/users/${mongoId}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });

  console.log('✓ Profile fetched by MongoDB ID:');
  console.log(JSON.stringify(profileByMongoId, null, 2));

  // Step 3: Fetch profile using Firebase UID
  console.log('\nStep 3: Fetching profile using Firebase UID...');
  const profileByFirebaseUid = await new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/users/${firebaseUid}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });

  console.log('✓ Profile fetched by Firebase UID:');
  console.log(JSON.stringify(profileByFirebaseUid, null, 2));

  // Verify both return the same user
  if (profileByMongoId.data && profileByFirebaseUid.data &&
      profileByMongoId.data.firebaseUid === profileByFirebaseUid.data.firebaseUid &&
      profileByMongoId.data.email === profileByFirebaseUid.data.email) {
    console.log('\n✅ SUCCESS: Both MongoDB ID and Firebase UID lookups return the same user!');
  } else {
    console.log('\n❌ ERROR: Lookups return different users!');
  }
}

testUserProfile()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
