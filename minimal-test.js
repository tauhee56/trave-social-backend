const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/status', (req, res) => {
  console.log('Got GET /api/status');
  res.json({ status: 'ok' });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
