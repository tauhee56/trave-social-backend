require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const admin = require('firebase-admin');
const path = require('path');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('✅ Cloudinary configured');

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

// Helper function to convert string to ObjectId
const toObjectId = (id) => {
  if (typeof id === 'object' && id._bsontype === 'ObjectId') return id;
  return new ObjectId(id);
};

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
// CRITICAL: Register router-based routes FIRST before inline routes to avoid conflicts
console.log('🔧 Loading router-based routes first...');

// User routes - REGISTER FIRST for nested routes like /api/users/:userId/posts
try {
  app.use('/api/users', require('../routes/users'));
  console.log('  ✅ /api/users (router) loaded - REGISTERED FIRST');
} catch (err) {
  console.warn('  ⚠️ /api/users (router) error:', err.message);
}

// Then load inline routes
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
    
    console.log('[POST] /api/media/upload - Received request');
    console.log('[POST] /api/media/upload - mediaFile length:', mediaFile?.length);
    console.log('[POST] /api/media/upload - mediaName:', mediaName);
    
    if (!mediaFile) {
      return res.status(400).json({ success: false, error: 'No file/image provided' });
    }

    // Upload to Cloudinary
    console.log('[POST] /api/media/upload - Attempting Cloudinary upload...');
    const result = await cloudinary.uploader.upload(mediaFile, {
      folder: 'trave-social/uploads',
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto'
    });

    console.log('[POST] /api/media/upload - ✅ Cloudinary upload successful:', result.secure_url);
    return res.json({ success: true, data: { url: result.secure_url, fileName: mediaName } });
  } catch (err) {
    console.error('[POST] /api/media/upload - ❌ Error:', err.message);
    console.error('[POST] /api/media/upload - Stack:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/media/upload loaded (with Cloudinary)');

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

// ============= INLINE USER-SCOPED ROUTES =============
// GET /api/users/:userId/posts - Get user's posts with privacy enforcement
app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    
    // Get user to check privacy
    const usersCollection = db.collection('users');
    const targetUser = await usersCollection.findOne({ _id: totoObjectId(userId) });
    
    // Check if user is private
    if (targetUser?.isPrivate) {
      // If user is private, only owner or followers can see posts
      if (!requesterUserId || requesterUserId === 'guest') {
        console.log('[GET] /api/users/:userId/posts - User is private, access denied');
        return res.json({ success: true, data: [], message: 'User profile is private' });
      }
      
      if (requesterUserId !== userId) {
        // Check if requester is follower
        const followsCollection = db.collection('follows');
        const isFollower = await followsCollection.findOne({
          followerId: toObjectId(requesterUserId),
          followingId: toObjectId(userId)
        });
        
        if (!isFollower) {
          console.log('[GET] /api/users/:userId/posts - User is private, requester not follower');
          return res.json({ success: true, data: [], message: 'User profile is private' });
        }
      }
    }
    
    const postsCollection = db.collection('posts');
    const posts = await postsCollection
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('[GET] /api/users/:userId/posts - Returned', posts?.length || 0, 'posts');
    res.json({ success: true, data: posts || [] });
  } catch (err) {
    console.error('[GET] /api/users/:userId/posts error:', err.message);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});
console.log('  ✅ /api/users/:userId/posts loaded with privacy enforcement');

// GET /api/users/:userId/sections
app.get('/api/users/:userId/sections', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');
    const sections = await sectionsCollection
      .find({ userId: userId })
      .sort({ order: 1 })
      .toArray();
    
    res.json({ success: true, data: sections || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});
console.log('  ✅ /api/users/:userId/sections loaded');

// GET /api/users/:userId/highlights
app.get('/api/users/:userId/highlights', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    const highlightsCollection = db.collection('highlights');
    const highlights = await highlightsCollection
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: highlights || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});
console.log('  ✅ /api/users/:userId/highlights loaded');

// GET /api/users/:userId/stories
app.get('/api/users/:userId/stories', async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUserId } = req.query;
    
    const db = mongoose.connection.db;
    const storiesCollection = db.collection('stories');
    const stories = await storiesCollection
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: stories || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});
console.log('  ✅ /api/users/:userId/stories loaded');

// POST /api/users/:userId/sections - Create section for user
app.post('/api/users/:userId/sections', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, postIds, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Section name required' });
    }

    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');

    // Get max order
    const lastSection = await sectionsCollection
      .findOne({ userId }, { sort: { order: -1 } });
    const nextOrder = (lastSection?.order || 0) + 1;

    const sectionData = {
      userId,
      name,
      postIds: postIds || [],
      coverImage: coverImage || null,
      order: nextOrder,
      createdAt: new Date()
    };

    const result = await sectionsCollection.insertOne(sectionData);
    sectionData._id = result.insertedId;

    console.log('[POST] /api/users/:userId/sections - Created:', sectionData._id);
    res.status(201).json({ success: true, data: sectionData });
  } catch (err) {
    console.error('[POST] /api/users/:userId/sections error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/sections (POST) loaded');

// PUT /api/users/:userId/sections/:sectionId - Update section
app.put('/api/users/:userId/sections/:sectionId', async (req, res) => {
  try {
    const { userId, sectionId } = req.params;
    const { name, postIds, coverImage } = req.body;

    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');

    const updateData = {};
    if (name) updateData.name = name;
    if (postIds) updateData.postIds = postIds;
    if (coverImage) updateData.coverImage = coverImage;

    const result = await sectionsCollection.findOneAndUpdate(
      { _id: toObjectId(sectionId), userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    console.log('[PUT] /api/users/:userId/sections/:sectionId - Updated:', sectionId);
    res.status(200).json({ success: true, data: result.value });
  } catch (err) {
    console.error('[PUT] /api/users/:userId/sections/:sectionId error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/sections/:sectionId (PUT) loaded');

// DELETE /api/users/:userId/sections/:sectionId - Delete section
app.delete('/api/users/:userId/sections/:sectionId', async (req, res) => {
  try {
    const { userId, sectionId } = req.params;

    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');

    const result = await sectionsCollection.deleteOne({
      _id: toObjectId(sectionId),
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    console.log('[DELETE] /api/users/:userId/sections/:sectionId - Deleted:', sectionId);
    res.status(200).json({ success: true, message: 'Section deleted' });
  } catch (err) {
    console.error('[DELETE] /api/users/:userId/sections/:sectionId error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/sections/:sectionId (DELETE) loaded');

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
// ALREADY REGISTERED AT TOP - DO NOT DUPLICATE

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
console.log('  ✅ /api/users/:uid/privacy loaded');

// POST /api/users/:userId/block/:blockUserId - Block a user
app.post('/api/users/:userId/block/:blockUserId', async (req, res) => {
  try {
    const { userId, blockUserId } = req.params;
    
    if (userId === blockUserId) {
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }
    
    const db = mongoose.connection.db;
    const blocksCollection = db.collection('blocks');
    
    // Check if already blocked
    const existing = await blocksCollection.findOne({
      blockerId: toObjectId(userId),
      blockedId: toObjectId(blockUserId)
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already blocked' });
    }
    
    // Add block
    const result = await blocksCollection.insertOne({
      blockerId: toObjectId(userId),
      blockedId: toObjectId(blockUserId),
      createdAt: new Date()
    });
    
    console.log('[POST] /api/users/:userId/block/:blockUserId - Blocked user:', blockUserId);
    res.status(201).json({ success: true, data: { blockId: result.insertedId } });
  } catch (err) {
    console.error('[POST] /api/users/:userId/block/:blockUserId error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/block/:blockUserId (POST) loaded');

// DELETE /api/users/:userId/block/:blockUserId - Unblock a user
app.delete('/api/users/:userId/block/:blockUserId', async (req, res) => {
  try {
    const { userId, blockUserId } = req.params;
    
    const db = mongoose.connection.db;
    const blocksCollection = db.collection('blocks');
    
    const result = await blocksCollection.deleteOne({
      blockerId: toObjectId(userId),
      blockedId: toObjectId(blockUserId)
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Block not found' });
    }
    
    console.log('[DELETE] /api/users/:userId/block/:blockUserId - Unblocked user:', blockUserId);
    res.status(200).json({ success: true, message: 'User unblocked' });
  } catch (err) {
    console.error('[DELETE] /api/users/:userId/block/:blockUserId error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/block/:blockUserId (DELETE) loaded');

// POST /api/posts/:postId/report - Report a post
app.post('/api/posts/:postId/report', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, reason, details } = req.body;
    
    if (!userId || !reason) {
      return res.status(400).json({ success: false, error: 'userId and reason required' });
    }
    
    const db = mongoose.connection.db;
    const reportsCollection = db.collection('reports');
    
    // Check if already reported by this user
    const existing = await reportsCollection.findOne({
      reporterId: toObjectId(userId),
      postId: toObjectId(postId)
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Already reported' });
    }
    
    const result = await reportsCollection.insertOne({
      postId: toObjectId(postId),
      reporterId: toObjectId(userId),
      reason,
      details: details || '',
      status: 'pending',
      createdAt: new Date()
    });
    
    console.log('[POST] /api/posts/:postId/report - Report created:', result.insertedId);
    res.status(201).json({ success: true, data: { reportId: result.insertedId } });
  } catch (err) {
    console.error('[POST] /api/posts/:postId/report error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/report (POST) loaded');

// POST /api/users/:userId/report - Report a user
app.post('/api/users/:userId/report', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reporterId, reason, details } = req.body;
    
    if (!reporterId || !reason) {
      return res.status(400).json({ success: false, error: 'reporterId and reason required' });
    }
    
    if (userId === reporterId) {
      return res.status(400).json({ success: false, error: 'Cannot report yourself' });
    }
    
    const db = mongoose.connection.db;
    const userReportsCollection = db.collection('user_reports');
    
    // Check if already reported
    const existing = await userReportsCollection.findOne({
      reporterId: toObjectId(reporterId),
      userId: toObjectId(userId)
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Already reported' });
    }
    
    const result = await userReportsCollection.insertOne({
      userId: toObjectId(userId),
      reporterId: toObjectId(reporterId),
      reason,
      details: details || '',
      status: 'pending',
      createdAt: new Date()
    });
    
    console.log('[POST] /api/users/:userId/report - User report created:', result.insertedId);
    res.status(201).json({ success: true, data: { reportId: result.insertedId } });
  } catch (err) {
    console.error('[POST] /api/users/:userId/report error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/report (POST) loaded');

// GET /api/users/:userId/profile-url - Get shareable profile URL
app.get('/api/users/:userId/profile-url', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Generate profile URL (assuming frontend domain)
    const profileUrl = `https://trave-social.expo.dev/profile/${userId}`;
    
    console.log('[GET] /api/users/:userId/profile-url - Generated:', profileUrl);
    res.json({ success: true, data: { profileUrl, userId } });
  } catch (err) {
    console.error('[GET] /api/users/:userId/profile-url error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/users/:userId/profile-url (GET) loaded');

// GET /api/notifications/:userId - Get user notifications
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    console.log('[GET] /api/notifications/:userId - userId:', userId);
    
    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
      console.log('[GET] /api/notifications/:userId - Invalid userId format');
      return res.json({ success: true, data: [], total: 0, message: 'Invalid userId' });
    }
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');
    
    const objId = toObjectId(userId);
    console.log('[GET] /api/notifications/:userId - Query with:', { recipientId: objId });
    
    const notifications = await notificationsCollection
      .find({ recipientId: objId })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip) || 0)
      .limit(parseInt(limit) || 50)
      .toArray();
    
    const total = await notificationsCollection.countDocuments({ recipientId: objId });
    
    console.log('[GET] /api/notifications/:userId - Returned', notifications?.length || 0, 'of', total);
    res.json({ success: true, data: notifications || [], total });
  } catch (err) {
    console.error('[GET] /api/notifications/:userId error:', err.message, err.stack);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});
console.log('  ✅ /api/notifications/:userId (GET) loaded');

// POST /api/notifications - Create notification (for likes, comments, follows)
app.post('/api/notifications', async (req, res) => {
  try {
    const { recipientId, senderId, type, postId, message } = req.body;
    
    if (!recipientId || !senderId || !type) {
      return res.status(400).json({ success: false, error: 'recipientId, senderId, type required' });
    }
    
    // Don't create notification if recipient is sender
    if (recipientId === senderId) {
      return res.status(200).json({ success: true, message: 'Notification not created (self)' });
    }
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');
    
    const notification = {
      recipientId: toObjectId(recipientId),
      senderId: toObjectId(senderId),
      type, // 'like', 'comment', 'follow', 'mention'
      postId: postId ? toObjectId(postId) : null,
      message: message || `${type} notification`,
      read: false,
      createdAt: new Date()
    };
    
    const result = await notificationsCollection.insertOne(notification);
    notification._id = result.insertedId;
    
    console.log('[POST] /api/notifications - Created:', type, 'for user:', recipientId);
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    console.error('[POST] /api/notifications error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/notifications (POST) loaded');

// PATCH /api/notifications/:notificationId/read - Mark notification as read
app.patch('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');
    
    const result = await notificationsCollection.findOneAndUpdate(
      { _id: toObjectId(notificationId) },
      { $set: { read: true, readAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    console.log('[PATCH] /api/notifications/:notificationId/read - Marked read');
    res.json({ success: true, data: result.value });
  } catch (err) {
    console.error('[PATCH] /api/notifications/:notificationId/read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/notifications/:notificationId/read (PATCH) loaded');

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