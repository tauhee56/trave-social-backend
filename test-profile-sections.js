const http = require('http');

const BASE_URL = 'http://localhost:5000';
const TEST_UID = '5WLYAqbq2phJqbJUj6El20zD9fC3';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testEndpoints() {
  console.log('\n🧪 Testing User Update & Section Endpoints\n');

  // Test 1: Update user profile
  console.log('1️⃣  Testing PUT /users/:uid (Update profile)');
  try {
    const result = await makeRequest('PUT', `/api/users/${TEST_UID}`, {
      displayName: 'Test User Updated',
      bio: 'This is an updated bio',
      website: 'https://example.com'
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Success: ${result.data.success}`);
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 2: Create section
  console.log('\n2️⃣  Testing POST /users/:uid/sections (Create section)');
  try {
    const result = await makeRequest('POST', `/api/users/${TEST_UID}/sections`, {
      name: 'Test Section',
      description: 'This is a test section',
      color: '#FF6B6B'
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Success: ${result.data.success}`);
    if (result.data.data) {
      console.log(`   Section ID: ${result.data.data._id}`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 3: Get sections
  console.log('\n3️⃣  Testing GET /users/:uid/sections (Get sections)');
  try {
    const result = await makeRequest('GET', `/api/users/${TEST_UID}/sections`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Success: ${result.data.success}`);
    console.log(`   Sections count: ${result.data.data.length}`);
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 4: Update section
  console.log('\n4️⃣  Testing PUT /users/:uid/sections/:name (Update section)');
  try {
    const result = await makeRequest('PUT', `/api/users/${TEST_UID}/sections/Test%20Section`, {
      description: 'Updated section description',
      color: '#4ECDC4'
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Success: ${result.data.success}`);
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 5: Delete section
  console.log('\n5️⃣  Testing DELETE /users/:uid/sections/:name (Delete section)');
  try {
    const result = await makeRequest('DELETE', `/api/users/${TEST_UID}/sections/Test%20Section`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Success: ${result.data.success}`);
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  console.log('\n✨ All tests complete!\n');
  process.exit(0);
}

testEndpoints();
