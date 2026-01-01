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
// CORS with explicit options for Render + mobile
app.use(cors({
  origin: ['https://trave-social-backend.onrender.com', 'http://localhost:3000', 'http://localhost:5000', 'http://localhost:8081', 'http://10.0.2.2:5000', '*'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
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
    .then(() => {
      console.log('✅ MongoDB connected');
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
    const posts = await mongoose.model('Post').find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'displayName name avatar profilePicture photoURL')
      .catch(() => []);
    console.log('🟢 [INLINE] /api/posts SUCCESS - returning', Array.isArray(posts) ? posts.length : 0, 'posts');
    res.status(200).json({ success: true, data: Array.isArray(posts) ? posts : [] });
  } catch (err) {
    console.log('🟢 [INLINE] /api/posts ERROR:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});

// POST /api/posts - Create new post
app.post('/api/posts', async (req, res) => {
  try {
    const { userId, content, caption, mediaUrls, imageUrls, location, locationData, mediaType, category, hashtags, mentions, taggedUserIds } = req.body;
    
    // Accept both 'content' and 'caption' for compatibility
    const finalContent = content || caption;
    
    if (!userId || !finalContent) {
      return res.status(400).json({ success: false, error: 'userId and caption/content required' });
    }
    
    const Post = mongoose.model('Post');
    
    // Handle both single imageUrl and mediaUrls array
    const images = mediaUrls && mediaUrls.length > 0 ? mediaUrls : (imageUrls ? imageUrls : []);
    
    const newPost = new Post({
      userId,
      content: finalContent,
      caption: finalContent,
      imageUrl: images[0] || null,
      mediaUrls: images || [],
      location: location || null,
      locationData: locationData || {},
      mediaType: mediaType || 'image',
      category: category || null,
      hashtags: hashtags || [],
      mentions: mentions || [],
      taggedUserIds: taggedUserIds || [],
      likes: [],
      likesCount: 0,
      comments: 0,
      commentsCount: 0,
      createdAt: new Date(),
    });
    
    const saved = await newPost.save();
    
    // Populate user data
    const populated = await Post.findById(saved._id)
      .populate('userId', 'displayName name avatar profilePicture photoURL');
    
    console.log('[POST] /api/posts - Created post:', populated._id);
    return res.status(201).json({ success: true, data: populated, postId: populated._id });
  } catch (err) {
    console.error('[POST] /api/posts error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/posts/:postId - Get single post with populated user data
app.get('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const Post = mongoose.model('Post');
    
    // Try ObjectId first
    let post = null;
    if (mongoose.Types.ObjectId.isValid(postId)) {
      post = await Post.findById(postId)
        .populate('userId', 'displayName name avatar profilePicture photoURL')
        .catch(() => null);
    }
    
    // Try string ID if ObjectId didn't work
    if (!post) {
      post = await Post.findOne({ id: postId })
        .populate('userId', 'displayName name avatar profilePicture photoURL')
        .catch(() => null);
    }
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    console.log('[GET] /api/posts/:postId - Found post:', postId);
    return res.json({ success: true, data: post });
  } catch (err) {
    console.error('[GET] /api/posts/:postId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
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

// Media upload endpoint
app.post('/api/media/upload', async (req, res) => {
  try {
    const { file, fileName, image, path } = req.body;
    
    // Support both { file, fileName } and { image, path } formats
    const mediaFile = file || image;
    const mediaName = fileName || path || 'media';
    
    if (!mediaFile) {
      return res.status(400).json({ success: false, error: 'No file/image provided' });
    }
    
    // For now, return a mock URL - in production, upload to cloud storage
    // If image is a base64 or URI, we can use it as-is or upload to Cloudinary/S3
    const mockUrl = `https://via.placeholder.com/400x400?text=${encodeURIComponent(mediaName)}`;
    
    // If image/file looks like base64 or data URI, store it and return a URL
    const isBase64 = typeof mediaFile === 'string' && (mediaFile.includes('base64') || mediaFile.startsWith('data:'));
    const isURI = typeof mediaFile === 'string' && mediaFile.startsWith('file://');
    
    // Return the image data or a mock URL
    const url = isBase64 || isURI ? mockUrl : mediaFile;
    
    console.log('[POST] /api/media/upload - returning', url);
    return res.json({ success: true, data: { url, fileName: mediaName } });
  } catch (err) {
    console.error('[POST] /api/media/upload error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/media/upload loaded');

// ============= INLINE ROUTES FOR MISSING ENDPOINTS =============

// GET /api/conversations - Get conversations (placeholder)
app.get('/api/conversations', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const conversations = await db.collection('conversations').find({}).limit(20).toArray();
    res.json({ success: true, data: conversations || [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/conversations loaded');

// GET /api/messages - Get messages (placeholder)
app.get('/api/messages', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const messages = await db.collection('messages').find({}).limit(50).toArray();
    res.json({ success: true, data: messages || [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/messages loaded');

// GET /api/stories - Get stories (placeholder, router will override)
app.get('/api/stories', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stories = await db.collection('stories').find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data: stories || [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/stories loaded');

// GET /api/highlights - Get highlights (placeholder)
app.get('/api/highlights', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const highlights = await db.collection('highlights').find({}).limit(20).toArray();
    res.json({ success: true, data: highlights || [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/highlights loaded');

// GET /api/sections - Get sections (placeholder)
app.get('/api/sections', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const sections = await db.collection('sections').find({}).sort({ order: 1 }).toArray();
    res.json({ success: true, data: sections || [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/sections loaded');

// GET /api/users/:uid - Get user profile
app.get('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('[GET] /api/users/:uid - Looking for user:', uid);
    
    const User = mongoose.model('User');
    
    // Build query - check firebaseUid first, then uid field, then try ObjectId if valid
    const query = { $or: [{ firebaseUid: uid }, { uid }] };
    
    // Only add _id if it's a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(uid)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(uid) });
    }
    
    console.log('[GET] /api/users/:uid - Query:', JSON.stringify(query));
    
    const user = await User.findOne(query);
    
    if (!user) {
      console.warn('[GET] /api/users/:uid - User not found for:', uid, ' - returning placeholder');
      // Return placeholder instead of 404
      return res.json({ 
        success: true, 
        data: {
          _id: uid,
          uid: uid,
          firebaseUid: uid,
          displayName: 'User_' + uid.slice(-6),
          email: '',
          avatar: null,
          bio: '',
          isPrivate: false,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0
        }
      });
    }
    
    // Ensure user has all expected fields
    const userData = {
      _id: user._id,
      uid: user.uid,
      firebaseUid: user.firebaseUid,
      displayName: user.displayName || user.name,
      name: user.name || user.displayName,
      username: user.username,
      email: user.email,
      avatar: user.avatar || user.photoURL,
      photoURL: user.photoURL || user.avatar,
      bio: user.bio,
      website: user.website,
      location: user.location,
      phone: user.phone,
      interests: user.interests,
      followersCount: user.followersCount || (user.followers?.length || 0),
      followingCount: user.followingCount || (user.following?.length || 0),
      postsCount: user.postsCount || 0,
      followers: user.followers || [],
      following: user.following || [],
      isPrivate: user.isPrivate || false,
      approvedFollowers: user.approvedFollowers || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    console.log('[GET] /api/users/:uid - Returning user data');
    return res.json({ success: true, data: userData });
  } catch (err) {
    console.error('[GET] /api/users/:uid error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:uid loaded');

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
// DISABLED TO DEBUG - try {
//  app.use('/api/posts', require('../routes/post'));
//  console.log('  ✅ /api/posts routes (like/unlike) loaded');
// } catch (err) {
//   console.warn('  ⚠️ /api/posts routes error:', err.message);
// }

// Posts routes feed endpoint
app.get('/api/posts/feed', async (req, res) => {
  try {
    const posts = await mongoose.model('Post').find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'displayName name avatar profilePicture photoURL')
      .catch(() => []);
    res.status(200).json({ success: true, data: Array.isArray(posts) ? posts : [] });
  } catch (err) {
    res.status(200).json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/posts/feed loaded');

// GET posts location count
app.get('/api/posts/location-count', async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const locations = await Post.aggregate([
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).catch(() => []);
    
    return res.json({ 
      success: true, 
      hasData: locations && locations.length > 0,
      data: locations || [] 
    });
  } catch (err) {
    console.error('[GET] /api/posts/location-count error:', err.message);
    return res.json({ success: true, hasData: false, data: [] });
  }
});
console.log('  ✅ /api/posts/location-count loaded');

// DISABLED TO DEBUG
// try {
//   app.use('/api/comments', require('../routes/comments'));
//   console.log('  ✅ /api/comments loaded');
// } catch (err) {
//   console.warn('  ⚠️ /api/comments error:', err.message);
// }

// DISABLED TO DEBUG
// try {
//   app.use('/api/messages', require('../routes/messages'));
//   console.log('  ✅ /api/messages loaded');
// } catch (err) {
//   console.warn('  ⚠️ /api/messages error:', err.message);
// }

// Update user profile (PATCH and PUT for profile editing)
app.put('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { displayName, name, bio, website, location, phone, interests, avatar, photoURL, isPrivate } = req.body;
    
    const User = mongoose.model('User');
    const query = { $or: [{ firebaseUid: uid }, { uid }] };
    
    if (mongoose.Types.ObjectId.isValid(uid)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(uid) });
    }
    
    const updateData = {
      displayName: displayName || name,
      name: name || displayName,
      bio: bio || null,
      website: website || null,
      location: location || null,
      phone: phone || null,
      interests: interests || [],
      avatar: avatar || photoURL || null,
      photoURL: photoURL || avatar || null,
      isPrivate: isPrivate !== undefined ? isPrivate : false,
      updatedAt: new Date(),
    };
    
    const user = await User.findOneAndUpdate(query, { $set: updateData }, { new: true });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('[Inline] PUT /api/users/:uid error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Same handler for PATCH
app.patch('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { displayName, name, bio, website, location, phone, interests, avatar, photoURL, isPrivate } = req.body;
    
    const User = mongoose.model('User');
    const query = { $or: [{ firebaseUid: uid }, { uid }] };
    
    if (mongoose.Types.ObjectId.isValid(uid)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(uid) });
    }
    
    const updateData = {
      displayName: displayName || name,
      name: name || displayName,
      bio: bio || null,
      website: website || null,
      location: location || null,
      phone: phone || null,
      interests: interests || [],
      avatar: avatar || photoURL || null,
      photoURL: photoURL || avatar || null,
      isPrivate: isPrivate !== undefined ? isPrivate : false,
      updatedAt: new Date(),
    };
    
    const user = await User.findOneAndUpdate(query, { $set: updateData }, { new: true });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('[Inline] PATCH /api/users/:uid error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DISABLED ALL ROUTER REQUIRES TO DEBUG
// try {
//   app.use('/api/users', require('../routes/users'));
//   console.log('  ✅ /api/users loaded');
// } catch (err) {
//   console.warn('  ⚠️ /api/users error:', err.message);
// }

// ALL ROUTES DISABLED FOR DEBUG - MINIMAL SERVER ONLY
// NOW RESTORING ESSENTIAL ROUTES

// Posts routes (for like/unlike endpoints)
try {
  app.use('/api/posts', require('../routes/post'));
  console.log('  ✅ /api/posts routes (like/unlike) loaded');
} catch (err) {
  console.warn('  ⚠️ /api/posts routes error:', err.message);
}

// User routes - JUST USERS ROUTER, NOT duplicate PUT/PATCH
// DISABLED: Using inline routes instead for better control
// try {
//   app.use('/api/users', require('../routes/users'));
//   console.log('  ✅ /api/users loaded');
// } catch (err) {
//   console.warn('  ⚠️ /api/users error:', err.message);
// }

// Conversations routes
try {
  app.use('/api/conversations', require('../routes/conversations'));
  console.log('  ✅ /api/conversations loaded');
} catch (err) {
  console.warn('  ⚠️ /api/conversations error:', err.message);
}

// Messages routes
try {
  app.use('/api/messages', require('../routes/messages'));
  console.log('  ✅ /api/messages loaded');
} catch (err) {
  console.warn('  ⚠️ /api/messages error:', err.message);
}

// Feed routes  
try {
  app.use('/api/feed', require('../routes/feed'));
  console.log('  ✅ /api/feed loaded');
} catch (err) {
  console.warn('  ⚠️ /api/feed error:', err.message);
}

// Stories routes
try {
  app.use('/api/stories', require('../routes/stories'));
  console.log('  ✅ /api/stories loaded');
} catch (err) {
  console.warn('  ⚠️ /api/stories error:', err.message);
}

// Highlights routes
try {
  app.use('/api/highlights', require('../routes/highlights'));
  console.log('  ✅ /api/highlights loaded');
} catch (err) {
  console.warn('  ⚠️ /api/highlights error:', err.message);
}

// Sections routes
try {
  app.use('/api/sections', require('../routes/sections'));
  console.log('  ✅ /api/sections loaded');
} catch (err) {
  console.warn('  ⚠️ /api/sections error:', err.message);
}

// Comments routes
try {
  app.use('/api/comments', require('../routes/comments'));
  console.log('  ✅ /api/comments loaded');
} catch (err) {
  console.warn('  ⚠️ /api/comments error:', err.message);
}

// Follow routes
try {
  app.use('/api/follow', require('../routes/follow'));
  console.log('  ✅ /api/follow loaded');
} catch (err) {
  console.warn('  ⚠️ /api/follow error:', err.message);
}

// Saved posts routes
try {
  app.use('/api/saved', require('../routes/saved'));
  console.log('  ✅ /api/saved loaded');
} catch (err) {
  console.warn('  ⚠️ /api/saved error:', err.message);
}

// Moderation routes
try {
  app.use('/api/moderation', require('../routes/moderation'));
  console.log('  ✅ /api/moderation loaded');
} catch (err) {
  console.warn('  ⚠️ /api/moderation error:', err.message);
}

// Notifications routes
try {
  app.use('/api/notifications', require('../routes/notification'));
  console.log('  ✅ /api/notifications loaded');
} catch (err) {
  console.warn('  ⚠️ /api/notifications error:', err.message);
}

// Categories routes
try {
  app.use('/api/categories', require('../routes/categories'));
  console.log('  ✅ /api/categories loaded');
} catch (err) {
  console.warn('  ⚠️ /api/categories error:', err.message);
}

console.log('✅ Routes loading complete');

// Get post comments
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const post = await Post.findById(req.params.postId)
      .select('comments')
      .populate({
        path: 'comments.userId',
        select: 'displayName name profilePicture avatar'
      });
    
    const comments = post?.comments || [];
    return res.json({ success: true, data: comments, hasData: comments.length > 0 });
  } catch (err) {
    console.error('[GET] /api/posts/:postId/comments error:', err.message);
    return res.json({ success: true, data: [], hasData: false });
  }
});

// Add comment to post
app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'Missing userId or text' });
    }
    
    const Post = mongoose.model('Post');
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    const comment = {
      userId,
      text,
      createdAt: new Date(),
      likes: []
    };
    
    post.comments = post.comments || [];
    post.comments.push(comment);
    await post.save();
    
    return res.json({ success: true, data: comment });
  } catch (err) {
    console.error('[POST] /api/posts/:postId/comments error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Privacy toggle endpoint
app.patch('/api/users/:uid/privacy', async (req, res) => {
  try {
    const { uid } = req.params;
    const { isPrivate } = req.body;
    
    if (isPrivate === undefined) {
      return res.status(400).json({ success: false, error: 'isPrivate is required' });
    }
    
    const User = mongoose.model('User');
    const query = { $or: [{ firebaseUid: uid }, { uid }] };
    
    if (mongoose.Types.ObjectId.isValid(uid)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(uid) });
    }
    
    const user = await User.findOneAndUpdate(
      query,
      { $set: { isPrivate, updatedAt: new Date() } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.json({ success: true, data: { isPrivate: user.isPrivate } });
  } catch (err) {
    console.error('[PATCH] /api/users/:uid/privacy error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

console.log('  ✅ Comments and privacy endpoints loaded');

// Add logging for unmatched routes (AFTER all routes defined)
app.use((req, res, next) => {
  console.log('📡', req.method, req.url, '- No handler found');
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

console.log('✅ 404 handler registered');

// ============= ERROR HANDLING =============
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

console.log('✅ Error handler registered');
console.log('🚀 STARTING SERVER - PORT:', PORT, typeof PORT);
console.log('🚀 STARTING SERVER - Type of PORT:', typeof PORT);

// ============= START SERVER =============
try {
  const server = app.listen(parseInt(PORT) || 5000, '0.0.0.0', () => {
    console.log(`✅ Backend running on port ${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log('🎉 SERVER LISTENING - READY FOR CONNECTIONS');
  });
  
  server.on('error', (err) => {
    console.error('❌ Server error:', err.message);
  });
} catch (err) {
  console.error('❌ Failed to start server:', err.message);
}

console.log('✅ Server startup code executed');

module.exports = app;