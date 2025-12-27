const http = require('http');

// Test login endpoint
function testLoginFirebase() {
  const testData = {
    firebaseUid: 'test-uid-1766756428812',
    email: 'testuser1766756428812@example.com',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg'
  };

  const postData = JSON.stringify(testData);

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login-firebase',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('\n✓ Login Response:');
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Run test
console.log('Testing Firebase Login Endpoint...');
testLoginFirebase()
  .then(() => {
    console.log('\n✅ Login test completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
