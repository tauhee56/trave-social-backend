const http = require('http');

const BASE_URL = 'http://localhost:5000';
const TEST_UID = '5WLYAqbq2phJqbJUj6El20zD9fC3';

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
            path
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            path
          });
        }
      });
    }).on('error', reject);
  });
}

async function testEndpoints() {
  console.log('\n🧪 Testing User Profile Endpoints\n');
  
  const endpoints = [
    `/api/users/${TEST_UID}`,
    `/api/users/${TEST_UID}/posts`,
    `/api/users/${TEST_UID}/highlights`,
    `/api/users/${TEST_UID}/sections`,
    `/api/users/${TEST_UID}/stories`
  ];

  for (const endpoint of endpoints) {
    try {
      const result = await makeRequest(endpoint);
      console.log(`✅ ${endpoint}`);
      console.log(`   Status: ${result.status}`);
      if (result.data.success !== undefined) {
        console.log(`   Success: ${result.data.success}`);
      }
      if (Array.isArray(result.data.data)) {
        console.log(`   Data count: ${result.data.data.length} items`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}`);
      console.log(`   Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ Test complete\n');
  process.exit(0);
}

testEndpoints();
