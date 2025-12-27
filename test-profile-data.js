const http = require('http');

// Test profile with all posts, highlights, sections, stories
async function testFullProfile() {
  // Use a known user from our database
  const testUserId = '5WLYAqbq2phJqbJUj6El20zD9fC3';

  console.log('Testing Full Profile Data Fetch...\n');
  console.log(`User ID: ${testUserId}\n`);

  const endpoints = [
    { path: `/api/users/${testUserId}`, label: 'User Profile' },
    { path: `/api/users/${testUserId}/posts`, label: 'User Posts' },
    { path: `/api/users/${testUserId}/sections`, label: 'User Sections' },
    { path: `/api/users/${testUserId}/highlights`, label: 'User Highlights' },
    { path: `/api/users/${testUserId}/stories`, label: 'User Stories' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:5000${endpoint.path}`, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        }).on('error', reject);
      });

      if (response.success && response.data) {
        const count = Array.isArray(response.data) ? response.data.length : 0;
        console.log(`✓ ${endpoint.label}: ${count} items`);
        if (count > 0 && endpoint.label === 'User Posts') {
          const post = response.data[0];
          console.log(`  └─ Sample post: ${post.caption || '(no caption)'} from ${post.userName}`);
        }
      } else {
        console.log(`✗ ${endpoint.label}: Failed`);
        console.log(`  Error: ${response.error}`);
      }
    } catch (err) {
      console.log(`✗ ${endpoint.label}: ${err.message}`);
    }
  }

  console.log('\n✅ Profile data fetch test complete!');
}

testFullProfile()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
