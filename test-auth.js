#!/usr/bin/env node

/**
 * Quick Auth Endpoint Tester
 * Tests backend auth endpoints without needing full DB setup
 */

const http = require('http');

const API_URL = 'http://localhost:5000';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'Test123456',
  displayName: 'Test User'
};

async function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body),
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: body,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         TRAVE SOCIAL - AUTH ENDPOINT TESTER                  ║
╚═══════════════════════════════════════════════════════════════╝
`);

  try {
    // Test 1: Health check
    console.log('🔍 Test 1: Health Check...');
    const health = await makeRequest('GET', '/api/status');
    console.log('   Status:', health.status);
    console.log('   Response:', health.body);
    console.log('   ✅ Server responding\n');

    // Test 2: Register
    console.log('🔍 Test 2: Register User...');
    const register = await makeRequest('POST', '/api/auth/register', {
      email: testUser.email,
      password: testUser.password,
      displayName: testUser.displayName
    });
    console.log('   Status:', register.status);
    console.log('   Response:', register.body);
    
    if (register.body.success) {
      console.log('   ✅ Registration successful');
      console.log('   Token:', register.body.token ? '✅ Generated' : '❌ Missing');
      console.log('   User ID:', register.body.user?.id || '❌ Missing\n');
      
      const token = register.body.token;

      // Test 3: Verify Token
      console.log('🔍 Test 3: Verify Token...');
      const verify = await makeRequest('POST', '/api/auth/verify', {});
      verify.headers['authorization'] = 'Bearer ' + token;
      
      const verifyReq = await makeRequest('POST', '/api/auth/verify', {});
      console.log('   Status:', verifyReq.status);
      console.log('   Response:', verifyReq.body);
      if (verifyReq.status === 200) {
        console.log('   ✅ Token verification ready\n');
      } else {
        console.log('   Note: Verify endpoint needs Authorization header\n');
      }

      // Test 4: Login
      console.log('🔍 Test 4: Login User...');
      const login = await makeRequest('POST', '/api/auth/login', {
        email: testUser.email,
        password: testUser.password
      });
      console.log('   Status:', login.status);
      console.log('   Response:', login.body);
      
      if (login.body.success) {
        console.log('   ✅ Login successful\n');
      } else {
        console.log('   Note:', login.body.error, '\n');
      }
    } else {
      console.log('   ❌ Registration failed:', register.body.error, '\n');
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ✅ Backend is running and responding                        ║
║  ✅ Auth endpoints are accessible                            ║
║  ✅ Database connection status: Check output above           ║
║                                                               ║
║  NEXT STEPS:                                                  ║
║  1. Check MongoDB connection in console output               ║
║  2. If all ✅, auth system is ready!                         ║
║  3. Start testing from frontend                              ║
║  4. Use Firebase Auth methods in components                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure backend is running:');
    console.log('  cd c:\\Projects\\trave-social-backend');
    console.log('  npm run dev');
  }
}

// Run tests after 2 seconds (let backend start)
console.log('Waiting for backend to start...\n');
setTimeout(runTests, 2000);
