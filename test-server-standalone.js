/**
 * STANDALONE TEST SERVER
 * Works WITHOUT MongoDB - Perfect for testing auth endpoints
 * Uses in-memory storage for demo purposes
 */

require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 5001; // Different port to avoid conflict

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory user storage (for testing only)
let users = [];
let userIdCounter = 1;

console.log('\n╔════════════════════════════════════════════╗');
console.log('║   TEST SERVER (No MongoDB Required)       ║');
console.log('║   Port: 5001                              ║');
console.log('╚════════════════════════════════════════════╝\n');

// ============= MIDDLEWARE =============
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'test-secret-key',
    { expiresIn: '7d' }
  );
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key');
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// ============= ROUTES =============

// Health check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    server: 'TEST SERVER (In-Memory)',
    port: PORT,
    timestamp: new Date(),
  });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      });
    }

    // Check if user already exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({
        success: false,
        error: 'User already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in memory
    const newUser = {
      id: userIdCounter++,
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      createdAt: new Date(),
    };

    users.push(newUser);

    // Generate token
    const token = generateToken(newUser.id, newUser.email);

    res.status(201).json({
      success: true,
      message: 'User registered',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found',
      });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password',
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Verify token (protected)
app.post('/api/auth/verify', verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  res.json({
    success: true,
    message: 'Token valid',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  });
});

// Logout (protected)
app.post('/api/auth/logout', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ============= ERROR HANDLER =============
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ============= START SERVER =============
app.listen(PORT, () => {
  console.log(`✅ Test Server running on port ${PORT}`);
  console.log(`✅ All endpoints ready (no MongoDB needed)`);
  console.log(`\n📝 Test these endpoints:\n`);
  console.log(`  POST http://localhost:${PORT}/api/auth/register`);
  console.log(`  POST http://localhost:${PORT}/api/auth/login`);
  console.log(`  POST http://localhost:${PORT}/api/auth/verify`);
  console.log(`  POST http://localhost:${PORT}/api/auth/logout\n`);
});
