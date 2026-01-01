const axios = require('axios');

const BASE_URL = 'https://trave-social-backend.onrender.com/api';
const TEST_USER_ID = '67467daa8ac0844f3eb20e14'; // Your test user ID

async function testInbox() {
  console.log('🔍 Testing Inbox API...\n');
  
  try {
    console.log(`📍 Testing: GET ${BASE_URL}/conversations?userId=${TEST_USER_ID}`);
    
    const response = await axios.get(`${BASE_URL}/conversations?userId=${TEST_USER_ID}`, {
      timeout: 10000
    });
    
    console.log('✅ Response received:');
    console.log('  Status:', response.status);
    console.log('  Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`\n✅ SUCCESS: Found ${response.data.data.length} conversations`);
    } else {
      console.log('\n⚠️  No conversations found (but endpoint working)');
    }
    
  } catch (error) {
    console.error('❌ Error:');
    console.error('  Message:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
  }
}

testInbox();
