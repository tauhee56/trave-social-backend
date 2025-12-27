const http = require('http');

// Test registration endpoint
function testRegisterFirebase() {
  const timestamp = Date.now();
  const testData = {
    firebaseUid: `test-uid-${timestamp}`,
    email: `testuser${timestamp}@example.com`,
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg'
  };

  const postData = JSON.stringify(testData);

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register-firebase',
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
          console.log('\n✓ Registration Response:');
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
console.log('Testing Firebase Registration Endpoint...');
testRegisterFirebase()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
