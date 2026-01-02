const axios = require('axios');

const BASE_URL = 'https://trave-social-backend.onrender.com/api';
const TEST_USER_ID = '67467daa8ac0844f3eb20e14';

async function testConversations() {
  try {
    console.log('🔍 Test 1: GET /conversations without data\n');
    const response1 = await axios.get(`${BASE_URL}/conversations?userId=${TEST_USER_ID}`, {
      timeout: 10000
    });
    console.log('✅ Response:', JSON.stringify(response1.data, null, 2));

    console.log('\n⏳ Waiting 5 seconds for Render to rebuild...\n');
    await new Promise(r => setTimeout(r, 5000));

    console.log('🔍 Test 2: Create test conversation\n');
    const createResp = await axios.post(`${BASE_URL}/test/create-conversation`, {
      userId1: TEST_USER_ID,
      userId2: '507f1f77bcf86cd799439011',
      lastMessage: 'Hey how are you?'
    }, { timeout: 10000 });
    
    console.log('✅ Created:', JSON.stringify(createResp.data, null, 2));

    console.log('\n🔍 Test 3: GET /conversations with data\n');
    const response2 = await axios.get(`${BASE_URL}/conversations?userId=${TEST_USER_ID}`, {
      timeout: 10000
    });
    console.log('✅ Conversations:', JSON.stringify(response2.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testConversations();
