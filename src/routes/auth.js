const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Use centralized User model from models directory
const User = require('../models/User');

// Simple in-memory user storage (for testing/demo - fallback)
let users = {};

/**
 * POST /api/auth/register-firebase
 * Register user with Firebase UID and save to MongoDB
 */
router.post('/register-firebase', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, avatar } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Firebase UID and email required' 
      });
    }

    // Check if user already exists
    let user = await User.findOne({ firebaseUid });
    
    if (!user) {
      // Create new user in MongoDB
      user = new User({
        firebaseUid,
        email,
        displayName: displayName || email.split('@')[0],
        avatar: avatar || null,
        followers: 0,
        following: 0
      });
      await user.save();
      console.log(`✅ User registered in MongoDB: ${email}`);
    } else {
      // Update existing user
      user.displayName = displayName || user.displayName;
      user.avatar = avatar || user.avatar;
      user.updatedAt = new Date();
      await user.save();
      console.log(`✅ User updated in MongoDB: ${email}`);
    }

    // Generate JWT token (for backend use)
    const token = jwt.sign(
      { userId: user._id, firebaseUid, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid,
        email,
        displayName: user.displayName,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('[Auth] Firebase register error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Registration failed' 
    });
  }
});

/**
 * POST /api/auth/login-firebase
 * Login with Firebase UID and sync MongoDB
 */
router.post('/login-firebase', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, avatar } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Firebase UID and email required' 
      });
    }

    // Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid });
    
    if (!user) {
      // First time login - create user
      user = new User({
        firebaseUid,
        email,
        displayName: displayName || email.split('@')[0],
        avatar: avatar || null
      });
      await user.save();
      console.log(`✅ New user created on login: ${email}`);
    } else {
      // Update user info
      user.displayName = displayName || user.displayName;
      user.avatar = avatar || user.avatar;
      user.updatedAt = new Date();
      await user.save();
      console.log(`✅ User updated on login: ${email}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, firebaseUid, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid,
        email,
        displayName: user.displayName,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('[Auth] Firebase login error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Login failed' 
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user with email and password (fallback - in-memory)
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if user already exists
    if (users[email]) {
      return res.status(400).json({ 
        success: false, 
        error: 'User already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'user_' + Date.now();

    // Create user
    users[email] = {
      id: userId,
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      createdAt: new Date()
    };

    // Generate JWT token
    const token = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User registered: ${email}`);

    res.json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        displayName: users[email].displayName
      }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Registration failed' 
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password required' 
      });
    }

    // Check if user exists
    const user = users[email];
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User logged in: ${email}`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Login failed' 
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify JWT token
 */
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      success: true,
      user: {
        id: decoded.userId,
        email: decoded.email
      }
    });
  } catch (error) {
    console.error('[Auth] Verify error:', error.message);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (token is invalidated on frontend)
 */
router.post('/logout', async (req, res) => {
  try {
    console.log('✅ User logged out');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Logout failed' 
    });
  }
});

module.exports = router;
