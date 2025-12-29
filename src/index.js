require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');

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
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Trave Social Backend' }));
app.get('/api/status', (req, res) => res.json({ success: true, status: 'online' }));

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

// Auth routes (new - proper implementation)
try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (err) {
  console.warn('⚠️ Auth routes error:', err.message);
}

// Existing routes (each wrapped in try-catch for safety)
try {
  app.use('/api/posts', require('../routes/posts'));
  console.log('  ✅ /api/posts loaded');
} catch (err) {
  console.warn('  ⚠️ /api/posts error:', err.message);
}

try {
  app.use('/api/comments', require('./routes/comment'));
  console.log('  ✅ /api/comments loaded');
} catch (err) {
  console.warn('  ⚠️ /api/comments error:', err.message);
}

try {
  app.use('/api/messages', require('./routes/message'));
  console.log('  ✅ /api/messages loaded');
} catch (err) {
  console.warn('  ⚠️ /api/messages error:', err.message);
}

try {
  app.use('/api/live-streams', require('./routes/livestream'));
  console.log('  ✅ /api/live-streams loaded');
} catch (err) {
  console.warn('  ⚠️ /api/live-streams error:', err.message);
}

try {
  app.use('/api/users', require('./routes/user'));
  console.log('  ✅ /api/users loaded');
} catch (err) {
  console.warn('  ⚠️ /api/users error:', err.message);
}

try {
  app.use('/api/highlights', require('./routes/highlight'));
  console.log('  ✅ /api/highlights loaded');
} catch (err) {
  console.warn('  ⚠️ /api/highlights error:', err.message);
}

try {
  app.use('/api/sections', require('./routes/section'));
  console.log('  ✅ /api/sections loaded');
} catch (err) {
  console.warn('  ⚠️ /api/sections error:', err.message);
}

try {
  app.use('/api/stories', require('./routes/story'));
  console.log('  ✅ /api/stories loaded');
} catch (err) {
  console.warn('  ⚠️ /api/stories error:', err.message);
}

try {
  app.use('/api/notifications', require('./routes/notification'));
  console.log('  ✅ /api/notifications loaded');
} catch (err) {
  console.warn('  ⚠️ /api/notifications error:', err.message);
}

try {
  app.use('/api/categories', require('./routes/categories'));
  console.log('  ✅ /api/categories loaded');
} catch (err) {
  console.warn('  ⚠️ /api/categories error:', err.message);
}

try {
  app.use('/api/conversations', require('../routes/conversations'));
  console.log('  ✅ /api/conversations loaded');
} catch (err) {
  console.warn('  ⚠️ /api/conversations error:', err.message);
}

try {
  app.use('/api/branding', require('./routes/branding'));
  console.log('  ✅ /api/branding loaded');
} catch (err) {
  console.warn('  ⚠️ /api/branding error:', err.message);
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