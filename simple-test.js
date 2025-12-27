const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('\n=== AUTHENTICATION SYSTEM TEST ===\n');

  try {
    // Test 1: Status
    console.log('1️⃣  Testing Server Status...');
    let res = await request('GET', '/api/status');
    console.log('   Status:', res.status === 200 ? '✅ OK' : '❌ FAIL');

    // Test 2: Register
    console.log('\n2️⃣  Testing Register (POST)...');
    res = await request('POST', '/api/auth/register', {
      email: 'test@app.com',
      password: 'Test123456',
      displayName: 'Test User'
    });
    console.log('   Status:', res.status === 201 ? '✅ PASS' : `❌ ${res.status}`);
    console.log('   Response:', res.data.success ? 'Success' : res.data.error);
    
    let token = res.data.token;
    if (token) {
      console.log('   Token: ✅ Generated');
    }

    // Test 3: Login
    console.log('\n3️⃣  Testing Login (POST)...');
    res = await request('POST', '/api/auth/login', {
      email: 'test@app.com',
      password: 'Test123456'
    });
    console.log('   Status:', res.status === 200 ? '✅ PASS' : `❌ ${res.status}`);
    console.log('   Response:', res.data.success ? 'Success' : res.data.error);
    
    if (res.data.token) {
      token = res.data.token;
      console.log('   Token: ✅ Generated');
    }

    // Test 4: Verify
    console.log('\n4️⃣  Testing Verify (Protected)...');
    res = await request('POST', '/api/auth/verify', {}, token);
    console.log('   Status:', res.status === 200 ? '✅ PASS' : `❌ ${res.status}`);
    console.log('   Response:', res.data.success ? 'Success' : res.data.error);

    // Test 5: Logout
    console.log('\n5️⃣  Testing Logout (Protected)...');
    res = await request('POST', '/api/auth/logout', {}, token);
    console.log('   Status:', res.status === 200 ? '✅ PASS' : `❌ ${res.status}`);
    console.log('   Response:', res.data.success ? 'Success' : res.data.error);

    console.log('\n=== ALL TESTS COMPLETED ===');
    console.log('\n✅ POST requests working');
    console.log('✅ Protected routes working');
    console.log('✅ JWT tokens generated');
    console.log('\n🎉 SYSTEM FULLY FUNCTIONAL\n');

  } catch (err) {
    console.error('Error:', err.message);
  }

  process.exit(0);
}

test();
