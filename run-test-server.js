#!/usr/bin/env node

/**
 * Simple test server runner without any dependencies
 * Just Express + JWT + bcrypt, no database
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 5001;
const JWT_SECRET = 'test-secret-key-12345';

app.use(cors());
app.use(express.json());

// In-memory storage
let users = [];
let userIdCounter = 1;

// Utilities
const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyTokenMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token' });
  }
  try {
    const token = auth.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Routes
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', server: 'TEST', port: PORT });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing email/password' });
    }
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ success: false, error: 'User exists' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: userIdCounter++,
      email,
      displayName: displayName || email,
      password: hash,
    };
    users.push(user);
    
    const token = generateToken(user.id, user.email);
    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing credentials' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    const token = generateToken(user.id, user.email);
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/verify', verifyTokenMiddleware, (req, res) => {
  try {
    const user = users.find(u => u.id === req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({
      success: true,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/logout', verifyTokenMiddleware, (req, res) => {
  try {
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Server error' });
});

// Start server
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  TEST SERVER RUNNING                 ║');
  console.log('║  Port: 5001                          ║');
  console.log('║  No Database Required                ║');
  console.log('╚═══════════════════════════════════════╝\n');
  console.log('✅ Ready for testing\n');
  console.log('Endpoints:');
  console.log('  POST http://localhost:5001/api/auth/register');
  console.log('  POST http://localhost:5001/api/auth/login');
  console.log('  POST http://localhost:5001/api/auth/verify');
  console.log('  POST http://localhost:5001/api/auth/logout\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port 5001 is already in use');
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
