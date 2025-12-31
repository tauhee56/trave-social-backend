require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');
const jwt = require('jsonwebtoken');


// ====== AUTO-REQUIRE ALL MODELS ======
require('../models/User');
require('../models/Post');
require('../models/Category');
require('../models/LiveStream');
require('../models/Conversation');
// Try to require additional models (may not exist)
try { require('../models/Section'); } catch (e) { console.warn('⚠️ Section model not found'); }
try { require('../models/Story'); } catch (e) { console.warn('⚠️ Story model not found'); }
try { require('../models/Highlight'); } catch (e) { console.warn('⚠️ Highlight model not found'); }

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const app = express();
const PORT = process.env.PORT || 5000;

// ============= FIREBASE INITIALIZATION =============
try {
  const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.warn('⚠️ Firebase Admin initialization warning:', error.message);
}

// ============= MIDDLEWARE =============
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date(),
    port: PORT
  });
});

// ============= DATABASE CONNECTION =============
const mongoUri = process.env.MONGO_URI;
if (mongoUri) {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(async () => {
      console.log('✅ MongoDB connected');
      
      // Clean up conflicting indexes on startup
      try {
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        // List all indexes
        const indexes = await usersCollection.listIndexes().toArray();
        
        // Drop all indexes except _id_ to fix conflicts
        for (const index of indexes) {
          if (index.name !== '_id_' && (index.name === 'uid_1' || (index.key && index.key.uid))) {
            try {
              await usersCollection.dropIndex(index.name);
              console.log(`✓ Dropped conflicting index: ${index.name}`);
            } catch (err) {
              // Index might already be dropped, continue
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Index cleanup warning:', err.message);
      }
    })
    .catch(err => console.warn('⚠️ MongoDB connection warning:', err.message));
} else {
  console.warn('⚠️ MONGO_URI not set in .env');
}

// ============= ROUTES =============
// CRITICAL: Register these FIRST before any app.use() middleware
console.log('🔧 Loading critical inline GET routes...');

app.get('/api/posts', async (req, res) => {
  console.log('🟢 [INLINE] GET /api/posts CALLED');
  try {
    const posts = await mongoose.model('Post').find().sort({ createdAt: -1 }).limit(50).catch(() => []);
    console.log('🟢 [INLINE] /api/posts SUCCESS - returning', Array.isArray(posts) ? posts.length : 0, 'posts');
    res.status(200).json({ success: true, data: Array.isArray(posts) ? posts : [] });
  } catch (err) {
    console.log('🟢 [INLINE] /api/posts ERROR:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});

app.get('/api/categories', async (req, res) => {
  console.log('  → GET /api/categories called');
  try {
    const categories = await mongoose.model('Category').find().catch(() => []);
    console.log('  ✓ /api/categories returning 200 with', Array.isArray(categories) ? categories.length : 0, 'categories');
    res.status(200).json({ success: true, data: Array.isArray(categories) ? categories : [] });
  } catch (err) {
    console.log('  ✓ /api/categories error, returning empty array:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});

app.get('/api/live-streams', async (req, res) => {
  console.log('  → GET /api/live-streams called');
  try {
    const streams = await mongoose.model('LiveStream').find({ isActive: true }).catch(() => []);
    console.log('  ✓ /api/live-streams returning 200 with', Array.isArray(streams) ? streams.length : 0, 'streams');
    res.status(200).json({ success: true, data: Array.isArray(streams) ? streams : [] });
  } catch (err) {
    console.log('  ✓ /api/live-streams error, returning empty array:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});

console.log('✅ Critical inline routes registered: /api/posts, /api/categories, /api/live-streams');

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Trave Social Backend' }));
app.get('/api/status', (req, res) => res.json({ success: true, status: 'online' }));

// Inline fallback profile/user endpoints (before router to avoid 404)
app.get('/api/users/:uid/posts', async (req, res) => {
  try {
    const { uid } = req.params;
    const Post = mongoose.model('Post');
    const posts = await Post.find({ userId: uid }).sort({ createdAt: -1 }).limit(50);
    return res.json({ success: true, data: posts || [] });
  } catch (err) {
    console.error('[Inline] GET /api/users/:uid/posts error:', err.message);
    return res.json({ success: true, data: [] });
  }
});

app.get('/api/users/:uid/sections', async (req, res) => {
  try {
    const { uid } = req.params;
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

app.get('/api/users/:uid/highlights', async (req, res) => {
  try {
    const { uid } = req.params;
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

app.get('/api/users/:uid/stories', async (req, res) => {
  try {
    const { uid } = req.params;
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

// Inline fallback auth routes to avoid 404 if router fails to load
app.post('/api/auth/login-firebase', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, avatar } = req.body || {};
    if (!firebaseUid || !email) {
      return res.status(400).json({ success: false, error: 'Firebase UID and email required' });
    }

    const User = mongoose.model('User');
    let user = await User.findOne({ firebaseUid });

    if (!user) {
      user = new User({
        firebaseUid,
        email,
        displayName: displayName || email.split('@')[0],
        avatar: avatar || null,
      });
      await user.save();
    } else {
      user.displayName = displayName || user.displayName;
      user.avatar = avatar || user.avatar;
      user.updatedAt = new Date();
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, firebaseUid, email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid,
        email,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('[Inline Auth] login-firebase error:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Login failed' });
  }
});

app.post('/api/auth/register-firebase', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, avatar } = req.body || {};
    if (!firebaseUid || !email) {
      return res.status(400).json({ success: false, error: 'Firebase UID and email required' });
    }

    const User = mongoose.model('User');
    let user = await User.findOne({ firebaseUid });

    if (!user) {
      user = new User({
        firebaseUid,
        email,
        displayName: displayName || email.split('@')[0],
        avatar: avatar || null,
        followers: 0,
        following: 0,
      });
      await user.save();
    } else {
      user.displayName = displayName || user.displayName;
      user.avatar = avatar || user.avatar;
      user.updatedAt = new Date();
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, firebaseUid, email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firebaseUid,
        email,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('[Inline Auth] register-firebase error:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Registration failed' });
  }
});

// Branding endpoint (logo, app name, etc.)
app.get('/api/branding', (req, res) => {
  res.json({
    success: true,
    data: {
      appName: 'Trave Social',
      logoUrl: null, // Add your logo URL here if you have one
      primaryColor: '#007AFF',
      secondaryColor: '#5856D6'
    }
  });
});

// Auth routes (already handled inline above - commenting out missing route)
// try {
//   app.use('/api/auth', require('./routes/auth'));
//   console.log('✅ Auth routes loaded');
// } catch (err) {
//   console.warn('⚠️ Auth routes error:', err.message);
// }

// Posts routes (for like/unlike endpoints)
try {
  app.use('/api/posts', require('../routes/post'));
  console.log('  ✅ /api/posts routes (like/unlike) loaded');
} catch (err) {
  console.warn('  ⚠️ /api/posts routes error:', err.message);
}

// Posts routes feed endpoint
app.get('/api/posts/feed', async (req, res) => {
  try {
    const posts = await mongoose.model('Post').find().sort({ createdAt: -1 }).limit(50).catch(() => []);
    res.status(200).json({ success: true, data: Array.isArray(posts) ? posts : [] });
  } catch (err) {
    res.status(200).json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/posts/feed loaded');

try {
  app.use('/api/comments', require('../routes/comments'));
  console.log('  ✅ /api/comments loaded');
} catch (err) {
  console.warn('  ⚠️ /api/comments error:', err.message);
}

try {
  app.use('/api/messages', require('../routes/messages'));
  console.log('  ✅ /api/messages loaded');
} catch (err) {
  console.warn('  ⚠️ /api/messages error:', err.message);
}

// User profile endpoint (before users router to avoid conflicts)
app.get('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const User = mongoose.model('User');
    
    // Build query - check firebaseUid first, then uid field, then try ObjectId if valid
    const query = { $or: [{ firebaseUid: uid }, { uid }] };
    
    // Only add _id if it's a valid MongoDB ObjectId (prevent auto-casting error)
    if (mongoose.Types.ObjectId.isValid(uid)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(uid) });
    }
    
    const user = await User.findOne(query).select('_id firebaseUid email displayName avatar bio followers following').lean();
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found', data: null });
    }
    
    return res.json({ 
      success: true, 
      data: {
        id: user._id || uid,
        uid: user.firebaseUid || uid,
        email: user.email || '',
        displayName: user.displayName || 'User',
        avatar: user.avatar || null,
        bio: user.bio || '',
        followers: user.followers || 0,
        following: user.following || 0
      }
    });
  } catch (err) {
    console.error('[Inline] GET /api/users/:uid error:', err.message);
    return res.status(200).json({ success: false, error: err.message, data: null });
  }
});

try {
  app.use('/api/users', require('../routes/users'));
  console.log('  ✅ /api/users loaded');
} catch (err) {
  console.warn('  ⚠️ /api/users error:', err.message);
}

try {
  app.use('/api/highlights', require('../routes/highlights'));
  console.log('  ✅ /api/highlights loaded');
} catch (err) {
  console.warn('  ⚠️ /api/highlights disabled:', err.message);
}

// Section routes are handled via /api/users/:uid/sections (in user routes)
// Skipping separate /api/sections route to avoid model re-registration conflicts
// try {
//   app.use('/api/sections', require('../routes/sections'));
//   console.log('  ✅ /api/sections loaded');
// } catch (err) {
//   console.warn('  ⚠️ /api/sections disabled:', err.message);
// }

try {
  app.use('/api/stories', require('../routes/stories'));
  console.log('  ✅ /api/stories loaded');
} catch (err) {
  console.warn('  ⚠️ /api/stories disabled:', err.message);
}

try {
  app.use('/api/notifications', require('../routes/notification'));
  console.log('  ✅ /api/notifications loaded');
} catch (err) {
  console.warn('  ⚠️ /api/notifications error:', err.message);
}

try {
  app.use('/api/conversations', require('../routes/conversations'));
  console.log('  ✅ /api/conversations loaded');
} catch (err) {
  console.warn('  ⚠️ /api/conversations error:', err.message);
}

// Branding route (disabled if not available)
try {
  app.use('/api/branding', require('../routes/branding'));
  console.log('  ✅ /api/branding loaded');
} catch (err) {
  console.warn('  ⚠️ /api/branding disabled:', err.message);
}

// Follow routes
try {
  app.use('/api', require('../routes/follow'));
  console.log('  ✅ /api/follow loaded');
} catch (err) {
  console.warn('  ⚠️ /api/follow error:', err.message);
}

// Passport routes
try {
  app.use('/api', require('../routes/passport'));
  console.log('  ✅ /api/passport loaded');
} catch (err) {
  console.warn('  ⚠️ /api/passport error:', err.message);
}

// Feed routes
try {
  app.use('/api/feed', require('../routes/feed'));
  console.log('  ✅ /api/feed loaded');
} catch (err) {
  console.warn('  ⚠️ /api/feed error:', err.message);
}

// Saved posts routes
try {
  app.use('/api/users', require('../routes/saved'));
  console.log('  ✅ /api/users/saved loaded');
} catch (err) {
  console.warn('  ⚠️ /api/users/saved error:', err.message);
}

// Moderation routes (block/report)
try {
  app.use('/api', require('../routes/moderation'));
  console.log('  ✅ /api/moderation loaded');
} catch (err) {
  console.warn('  ⚠️ /api/moderation error:', err.message);
}

console.log('✅ Routes loading complete');

// Add logging for unmatched routes (AFTER all routes defined)
app.use((req, res, next) => {
  console.log('📡', req.method, req.url, '- No handler found');
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ============= ERROR HANDLING =============
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ============= START SERVER =============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
});

module.exports = app;