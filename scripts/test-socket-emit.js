/**
 * Test Socket.IO emit manually
 * Run this while backend is running to test if Socket.IO rooms work
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:5000';
const TEST_USER_1 = '6956afd36d2fa5db6bdb2909';
const TEST_USER_2 = 'QhfyDduvKweF0bKjl1GEsHo2RlB3';
const TEST_CONVERSATION_ID = `${TEST_USER_1}_${TEST_USER_2}`;

console.log('🧪 Testing Socket.IO connection and rooms...\n');

// Create two socket connections (simulating two users)
const socket1 = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: false
});

const socket2 = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: false
});

// User 1 (sender)
socket1.on('connect', () => {
  console.log('✅ Socket 1 connected:', socket1.id);
  
  // Join as user 1
  socket1.emit('join', TEST_USER_1);
  
  // Subscribe to conversation
  socket1.emit('subscribeToConversation', TEST_CONVERSATION_ID);
  console.log('📬 Socket 1 subscribed to conversation:', TEST_CONVERSATION_ID);
});

socket1.on('connected', (data) => {
  console.log('👤 Socket 1 joined as:', data.userId);
});

socket1.on('newMessage', (message) => {
  console.log('📥 Socket 1 received message:', {
    from: message.senderId,
    text: message.text,
    conversationId: message.conversationId
  });
});

// User 2 (recipient)
socket2.on('connect', () => {
  console.log('✅ Socket 2 connected:', socket2.id);
  
  // Join as user 2
  socket2.emit('join', TEST_USER_2);
  
  // Subscribe to conversation
  socket2.emit('subscribeToConversation', TEST_CONVERSATION_ID);
  console.log('📬 Socket 2 subscribed to conversation:', TEST_CONVERSATION_ID);
  
  // Wait 2 seconds then send test message from socket 1
  setTimeout(() => {
    console.log('\n📤 Sending test message from Socket 1...\n');
    
    socket1.emit('sendMessage', {
      conversationId: TEST_CONVERSATION_ID,
      senderId: TEST_USER_1,
      recipientId: TEST_USER_2,
      text: '🧪 Test message from script',
      timestamp: new Date()
    });
  }, 2000);
  
  // Close after 5 seconds
  setTimeout(() => {
    console.log('\n✅ Test complete! Closing connections...');
    socket1.close();
    socket2.close();
    process.exit(0);
  }, 5000);
});

socket2.on('connected', (data) => {
  console.log('👤 Socket 2 joined as:', data.userId);
});

socket2.on('newMessage', (message) => {
  console.log('📥 Socket 2 received message:', {
    from: message.senderId,
    text: message.text,
    conversationId: message.conversationId
  });
});

// Error handlers
socket1.on('connect_error', (error) => {
  console.error('❌ Socket 1 connection error:', error.message);
});

socket2.on('connect_error', (error) => {
  console.error('❌ Socket 2 connection error:', error.message);
});

socket1.on('messageError', (error) => {
  console.error('❌ Socket 1 message error:', error);
});

socket2.on('messageError', (error) => {
  console.error('❌ Socket 2 message error:', error);
});

