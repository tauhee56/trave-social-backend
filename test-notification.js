const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    if (!options.headers) options.headers = {};
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  try {
    console.log('Testing notification endpoint...\n');
    
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/notifications',
      method: 'POST'
    }, {
      recipientId: 'user-123',
      type: 'like',
      message: 'Someone liked your post'
    });
    
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
