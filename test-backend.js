#!/usr/bin/env node

/**
 * Standalone Backend Test
 * Tests auth without requiring full database setup
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for testing
const users = {};

// Generate token
function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify token middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing authorization' });
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// Routes
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Test Backend' }));
app.get('/api/status', (req, res) => res.json({ success: true, status: 'online' }));

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password too short' });
    }
    
    if (users[email]) {
      return res.status(400).json({ success: false, error: 'User exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    
    users[email] = {
      id: userId,
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
    };
    
    const token = generateToken(userId, email);
    
    res.status(201).json({
      success: true,
      message: 'User registered',
      token,
      user: {
        id: userId,
        email,
        displayName: users[email].displayName,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    const user = users[email];
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    const token = generateToken(user.id, email);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify
app.post('/api/auth/verify', verifyToken, (req, res) => {
  const user = users[req.user.email];
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: req.user.email,
      displayName: user.displayName,
    },
  });
});

// Logout
app.post('/api/auth/logout', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Logout successful' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═════════════════════════════════════════════════════════════╗
║  ✅ TEST BACKEND RUNNING ON PORT ${PORT}                       ║
╚═════════════════════════════════════════════════════════════╝

📋 ENDPOINTS:

  GET  /api/status                    - Health check
  POST /api/auth/register             - Register user
  POST /api/auth/login                - Login user
  POST /api/auth/verify               - Verify token

🧪 TEST WITH:

  node test-auth.js

  OR

  curl -X POST http://localhost:5000/api/auth/register \\
    -H "Content-Type: application/json" \\
    -d '{"email":"test@test.com","password":"Test123456"}'

═════════════════════════════════════════════════════════════
  `);
});
