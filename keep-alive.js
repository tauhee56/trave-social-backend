// Keep-alive script to prevent Render free tier from sleeping
const https = require('https');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

function ping() {
  const url = `${BACKEND_URL}/api/status`;
  
  https.get(url, (res) => {
    console.log(`[${new Date().toISOString()}] Ping successful - Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Ping failed:`, err.message);
  });
}

// Ping immediately on start
console.log('🏓 Keep-alive service started');
console.log(`   Pinging ${BACKEND_URL} every 10 minutes`);
ping();

// Then ping every 10 minutes
setInterval(ping, PING_INTERVAL);

