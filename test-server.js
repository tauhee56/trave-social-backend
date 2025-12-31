const express = require('express');
const app = express();

console.log('1. Express app created');

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

console.log('2. Routes added');

const PORT = 5001;
console.log('3. About to listen on port', PORT);

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log('4. SERVER IS LISTENING ON PORT', PORT);
  console.log('   Try: http://localhost:' + PORT);
});

server.on('error', (err) => {
  console.error('5. Server error:', err);
});

setTimeout(() => {
  console.log('6. 10 seconds passed, server still running');
}, 10000);
