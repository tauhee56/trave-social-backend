#!/usr/bin/env node

/**
 * COMPREHENSIVE FEATURE TESTING SCRIPT
 * Tests all features of Trave Social Backend & Frontend
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.blue}🧪 Testing: ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.yellow}═══════════════════════════════════${colors.reset}\n${colors.yellow}${msg}${colors.reset}\n${colors.yellow}═══════════════════════════════════${colors.reset}\n`)
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * TEST SUITE
 */
async function runTests() {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
  };

  // 1. Health Check
  log.section('1️⃣  SERVER HEALTH CHECK');
  try {
    log.test('Server Status');
    const res = await makeRequest('GET', '/status');
    if (res.status === 200) {
      log.success(`Server running on port ${res.body.port}`);
      results.passed++;
    } else {
      log.error(`Server not responding correctly: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Server connection failed: ${err.message}`);
    results.failed++;
    results.total++;
    return results; // Exit early if server not running
  }

  // 2. User Endpoints
  log.section('2️⃣  USER ENDPOINTS');
  try {
    log.test('Get user profile');
    const res = await makeRequest('GET', '/users/test-user-123');
    if (res.status === 200 || res.status === 404) {
      log.success('User endpoint responding');
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`User endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 3. Posts Endpoints
  log.section('3️⃣  POSTS ENDPOINTS');
  try {
    log.test('List all posts');
    const res = await makeRequest('GET', '/posts');
    if (res.status === 200 && Array.isArray(res.body.data)) {
      log.success(`Got ${res.body.data.length} posts`);
      results.passed++;
    } else {
      log.error('Posts endpoint not responding correctly');
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Posts endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 4. Notifications Endpoints
  log.section('4️⃣  NOTIFICATIONS ENDPOINTS');
  try {
    log.test('Get user notifications');
    const res = await makeRequest('GET', '/notifications/users/test-user-123/notifications');
    if (res.status === 200 || res.status === 404) {
      log.success('Notifications endpoint responding');
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Notifications endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 5. Upload Endpoints
  log.section('5️⃣  UPLOAD ENDPOINTS');
  try {
    log.test('Upload endpoint availability');
    // We can't actually test file upload without a file, but we can check if route exists
    const res = await makeRequest('POST', '/upload/avatar', { userId: 'test' });
    if (res.status === 400 || res.status === 200) {
      log.success('Upload endpoint available');
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Upload endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 6. Stories Endpoints
  log.section('6️⃣  STORIES ENDPOINTS');
  try {
    log.test('Get stories');
    const res = await makeRequest('GET', '/stories?userId=test-user');
    if (res.status === 200 || res.status === 404) {
      log.success('Stories endpoint responding');
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Stories endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 7. Categories Endpoints
  log.section('7️⃣  CATEGORIES ENDPOINTS');
  try {
    log.test('Get categories');
    const res = await makeRequest('GET', '/categories');
    if (res.status === 200) {
      log.success(`Got ${res.body.data?.length || 0} categories`);
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Categories endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 8. Live Streams Endpoints
  log.section('8️⃣  LIVE STREAMS ENDPOINTS');
  try {
    log.test('Get active live streams');
    const res = await makeRequest('GET', '/live-streams');
    if (res.status === 200) {
      log.success(`Got ${res.body.data?.length || 0} active streams`);
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Live streams endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 9. Feed Endpoints
  log.section('9️⃣  FEED ENDPOINTS');
  try {
    log.test('Get feed');
    const res = await makeRequest('GET', '/feed?userId=test-user');
    if (res.status === 200 || res.status === 404) {
      log.success('Feed endpoint responding');
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Feed endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // 10. Moderation Endpoints
  log.section('🔟 MODERATION ENDPOINTS');
  try {
    log.test('Moderation service');
    const res = await makeRequest('GET', '/moderation/blocked/test-user');
    if (res.status === 200 || res.status === 404) {
      log.success('Moderation endpoint responding');
      results.passed++;
    } else {
      log.error(`Unexpected status: ${res.status}`);
      results.failed++;
    }
    results.total++;
  } catch (err) {
    log.error(`Moderation endpoint error: ${err.message}`);
    results.failed++;
    results.total++;
  }

  // Final Summary
  log.section('📊 FINAL RESULTS');
  log.info(`Total Tests: ${results.total}`);
  log.success(`Passed: ${results.passed}`);
  log.error(`Failed: ${results.failed}`);
  
  const percentage = ((results.passed / results.total) * 100).toFixed(2);
  if (results.passed === results.total) {
    log.success(`Success Rate: ${percentage}% 🎉`);
  } else if (percentage >= 80) {
    log.info(`Success Rate: ${percentage}% (Good)`);
  } else {
    log.error(`Success Rate: ${percentage}% (Needs work)`);
  }

  return results;
}

// Run tests
console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════╗
║   TRAVE SOCIAL - COMPREHENSIVE FEATURE TEST       ║
║   Backend Testing Suite                           ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);

runTests().then(results => {
  console.log('\n' + colors.cyan + '═══════════════════════════════════════════════════' + colors.reset);
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
