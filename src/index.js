require('dotenv').config();
// CRITICAL DEPLOY: 2026-01-03T02:30:00Z - Conversation creation logic
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
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

// ============= MULTER SETUP FOR FILE UPLOADS =============
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for videos
});

const app = express();
const PORT = process.env.PORT || 5000;

// ============= HELPER FUNCTIONS =============
// Helper function to convert string to ObjectId (using mongoose.Types.ObjectId to avoid BSON version conflicts)
const toObjectId = (id) => {
  if (typeof id === 'object' && (id instanceof mongoose.Types.ObjectId || id._bsontype === 'ObjectId')) return id;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (err) {
    console.error('Invalid ObjectId:', id, err.message);
    return null;
  }
};

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
  console.log('🟢 [INLINE] GET /api/posts CALLED with query:', req.query);
  try {
    const { skip = 0, limit = 50 } = req.query;
    const currentUserId = req.headers.userid || null; // Get current user from header (optional)
    
    const posts = await mongoose.model('Post').find()
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'displayName name avatar profilePicture photoURL isPrivate followers')
      .catch(() => []);
    
    // Enrich posts and apply privacy filter
    const enrichedPosts = posts.map(post => {
      const postObj = post.toObject ? post.toObject() : post;
      
      // Calculate likes count
      let likesCount = postObj.likesCount;
      const likesArray = postObj.likes || [];
      const calculatedCount = Array.isArray(likesArray) ? likesArray.length : (typeof likesArray === 'object' ? Object.keys(likesArray).length : 0);
      
      if (!likesCount || likesCount === undefined || likesCount === 0) {
        likesCount = calculatedCount;
      }
      
      // Calculate comments count
      let commentCount = postObj.commentCount;
      if (!commentCount || commentCount === undefined) {
        const commentsArray = postObj.comments || [];
        commentCount = Array.isArray(commentsArray) ? commentsArray.length : (typeof commentsArray === 'object' ? Object.keys(commentsArray).length : 0);
      }
      
      return {
        ...postObj,
        likesCount,
        commentCount,
        isPrivate: postObj.isPrivate || false,
        allowedFollowers: postObj.allowedFollowers || []
      };
    });
    
    console.log('🟢 [INLINE] /api/posts SUCCESS - returning', enrichedPosts.length, 'posts');
    enrichedPosts.slice(0, 1).forEach(p => {
      console.log(`  Post response: id=${p._id}, likesCount=${p.likesCount}, isPrivate=${p.isPrivate}, allowedFollowers=${p.allowedFollowers?.length || 0}`);
    });
    
    res.status(200).json({ success: true, data: enrichedPosts });
  } catch (err) {
    console.log('🟢 [INLINE] /api/posts ERROR:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});

// GET /api/posts/feed - Get feed posts (MUST be before /:postId)
app.get('/api/posts/feed', async (req, res) => {
  try {
    const posts = await mongoose.model('Post').find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'displayName name avatar profilePicture photoURL isPrivate followers')
      .catch(() => []);
    
    const enrichedPosts = (Array.isArray(posts) ? posts : []).map(p => {
      const postObj = p.toObject ? p.toObject() : p;
      return {
        ...postObj,
        isPrivate: postObj.isPrivate || false,
        allowedFollowers: postObj.allowedFollowers || []
      };
    });
    
    res.status(200).json({ success: true, data: enrichedPosts });
  } catch (err) {
    res.status(200).json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/posts/feed loaded');

// GET /api/posts/location-count - Get location count (MUST be before /:postId)
app.get('/api/posts/location-count', async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const locations = await Post.aggregate([
      { $match: { location: { $exists: true, $ne: null, $ne: '' } } },
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

// POST /api/posts - Create new post
app.post('/api/posts', async (req, res) => {
  try {
    const { userId, content, caption, mediaUrls, imageUrls, location, locationData, mediaType, category, hashtags, mentions, taggedUserIds } = req.body;
    
    // Accept both 'content' and 'caption' for compatibility
    const finalContent = content || caption || '';
    
    // Handle both single imageUrl and mediaUrls array
    const images = mediaUrls && mediaUrls.length > 0 ? mediaUrls : (imageUrls ? imageUrls : []);
    
    // Validation: Either content or media is required
    if (!userId || (!finalContent && (!images || images.length === 0))) {
      return res.status(400).json({ success: false, error: 'userId and either caption or media required' });
    }
    
    const Post = mongoose.model('Post');
    const User = mongoose.model('User');
    
    // Get user's privacy setting
    const user = await User.findById(userId).catch(() => null);
    const isPrivate = user?.isPrivate || false;
    const allowedFollowers = isPrivate ? (user?.followers || []) : []; // If private, only followers can see
    
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
      isPrivate,
      allowedFollowers,
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
    const db = mongoose.connection.db;
    const streams = await db.collection('livestreams')
      .find({ isActive: true })
      .toArray()
      .catch(() => []);
    console.log('  ✓ /api/live-streams returning 200 with', Array.isArray(streams) ? streams.length : 0, 'streams');
    res.status(200).json({ success: true, data: Array.isArray(streams) ? streams : [] });
  } catch (err) {
    console.log('  ✓ /api/live-streams error, returning empty array:', err.message);
    res.status(200).json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/live-streams (GET) loaded');

// GET /api/live-streams/:streamId - Get single live stream
app.get('/api/live-streams/:streamId', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stream = await db.collection('livestreams').findOne({ 
      _id: toObjectId(req.params.streamId) 
    });
    
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    
    res.json({ success: true, data: stream });
  } catch (err) {
    console.error('[GET] /api/live-streams/:streamId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId (GET) loaded');

// POST /api/live-streams - Start new live stream
app.post('/api/live-streams', async (req, res) => {
  try {
    const { userId, title } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ success: false, error: 'userId and title required' });
    }
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const newStream = {
      userId,
      title,
      isActive: true,
      viewers: [],
      viewerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await livestreamsCollection.insertOne(newStream);
    
    console.log('[POST] /api/live-streams - Stream started:', result.insertedId);
    res.status(201).json({ success: true, id: result.insertedId, data: newStream });
  } catch (err) {
    console.error('[POST] /api/live-streams error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams (POST) loaded');

// PATCH /api/live-streams/:streamId/end - End live stream
app.patch('/api/live-streams/:streamId/end', async (req, res) => {
  try {
    const { userId } = req.body;
    const { streamId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const stream = await livestreamsCollection.findOne({ _id: toObjectId(streamId) });
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    
    if (stream.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Only stream owner can end the stream' });
    }
    
    const updated = await livestreamsCollection.findOneAndUpdate(
      { _id: toObjectId(streamId) },
      { $set: { isActive: false, endedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    console.log('[PATCH] /api/live-streams/:streamId/end - Stream ended:', streamId);
    res.json({ success: true, data: updated.value });
  } catch (err) {
    console.error('[PATCH] /api/live-streams/:streamId/end error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/end (PATCH) loaded');

// POST /api/live-streams/:streamId/agora-token - Generate Agora token
app.post('/api/live-streams/:streamId/agora-token', async (req, res) => {
  try {
    const { userId, role } = req.body;
    const { streamId } = req.params;
    
    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'userId and role required' });
    }
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const stream = await livestreamsCollection.findOne({ _id: toObjectId(streamId) });
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    
    // Generate Agora token (using RTC token v2 approach)
    // In production, use agora-token-builder package for proper token generation
    const agoraAppId = process.env.AGORA_APP_ID || 'demo-app-id';
    const agoraAppCertificate = process.env.AGORA_APP_CERTIFICATE || 'demo-app-certificate';
    
    // Simple token format (for demo - use proper agora-token-builder in production)
    const token = Buffer.from(
      JSON.stringify({
        appId: agoraAppId,
        channelName: streamId,
        userId: userId,
        role: role,
        expirationSeconds: 3600,
        timestamp: Math.floor(Date.now() / 1000)
      })
    ).toString('base64');
    
    // Add viewer to stream if subscriber
    if (role === 'subscriber') {
      const viewers = stream.viewers || [];
      if (!viewers.includes(userId)) {
        viewers.push(userId);
        await livestreamsCollection.updateOne(
          { _id: toObjectId(streamId) },
          { 
            $set: { 
              viewers,
              viewerCount: viewers.length
            }
          }
        );
      }
    }
    
    console.log('[POST] /api/live-streams/:streamId/agora-token - Token generated for', userId, 'role:', role);
    res.json({ 
      success: true, 
      token,
      agoraAppId,
      channelName: streamId,
      userId,
      role,
      expirationSeconds: 3600
    });
  } catch (err) {
    console.error('[POST] /api/live-streams/:streamId/agora-token error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/agora-token (POST) loaded');

// POST /api/live-streams/:streamId/leave - User leaves stream
app.post('/api/live-streams/:streamId/leave', async (req, res) => {
  try {
    const { userId } = req.body;
    const { streamId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const stream = await livestreamsCollection.findOne({ _id: toObjectId(streamId) });
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    
    const viewers = stream.viewers || [];
    const updatedViewers = viewers.filter(v => v !== userId);
    
    const updated = await livestreamsCollection.findOneAndUpdate(
      { _id: toObjectId(streamId) },
      { 
        $set: { 
          viewers: updatedViewers,
          viewerCount: updatedViewers.length
        }
      },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/live-streams/:streamId/leave - User', userId, 'left stream');
    res.json({ success: true, data: updated.value });
  } catch (err) {
    console.error('[POST] /api/live-streams/:streamId/leave error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/leave (POST) loaded');

// POST /api/live-streams/:streamId/comments - Add comment to live stream
app.post('/api/live-streams/:streamId/comments', async (req, res) => {
  try {
    const { userId, text, userName, userAvatar } = req.body;
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'userId and text required' });
    }
    
    const db = mongoose.connection.db;
    const liveStreamCommentsCollection = db.collection('livestream_comments');
    
    const newComment = {
      streamId: req.params.streamId,
      userId,
      userName: userName || 'Anonymous',
      userAvatar: userAvatar || null,
      text,
      createdAt: new Date(),
      likes: [],
      likesCount: 0,
      reactions: {}
    };
    
    const result = await liveStreamCommentsCollection.insertOne(newComment);
    
    console.log('[POST] /api/live-streams/:streamId/comments - Comment added:', result.insertedId);
    return res.status(201).json({ success: true, id: result.insertedId, data: newComment });
  } catch (err) {
    console.error('[POST] /api/live-streams/:streamId/comments error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/comments (POST) loaded');

// GET /api/live-streams/:streamId/comments - Get all comments on live stream
app.get('/api/live-streams/:streamId/comments', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const liveStreamCommentsCollection = db.collection('livestream_comments');
    
    const comments = await liveStreamCommentsCollection
      .find({ streamId: req.params.streamId })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('[GET] /api/live-streams/:streamId/comments - Found:', comments.length);
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error('[GET] /api/live-streams/:streamId/comments error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/comments (GET) loaded');

// PATCH /api/live-streams/:streamId/comments/:commentId - Edit comment
app.patch('/api/live-streams/:streamId/comments/:commentId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const { streamId, commentId } = req.params;
    
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'userId and text required' });
    }
    
    const db = mongoose.connection.db;
    const liveStreamCommentsCollection = db.collection('livestream_comments');
    
    const comment = await liveStreamCommentsCollection.findOne({ 
      _id: toObjectId(commentId),
      streamId: streamId
    });
    
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    if (comment.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized - can only edit own comments' });
    }
    
    const updated = await liveStreamCommentsCollection.findOneAndUpdate(
      { _id: toObjectId(commentId) },
      { $set: { text, editedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    console.log('[PATCH] /api/live-streams/:streamId/comments/:commentId - Updated:', commentId);
    res.json({ success: true, data: updated.value });
  } catch (err) {
    console.error('[PATCH] /api/live-streams/:streamId/comments/:commentId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/comments/:commentId (PATCH) loaded');

// DELETE /api/live-streams/:streamId/comments/:commentId - Delete comment
app.delete('/api/live-streams/:streamId/comments/:commentId', async (req, res) => {
  try {
    const { userId } = req.body;
    const { streamId, commentId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    const db = mongoose.connection.db;
    const liveStreamCommentsCollection = db.collection('livestream_comments');
    
    const comment = await liveStreamCommentsCollection.findOne({ 
      _id: toObjectId(commentId),
      streamId: streamId
    });
    
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    if (comment.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized - can only delete own comments' });
    }
    
    await liveStreamCommentsCollection.deleteOne({ _id: toObjectId(commentId) });
    
    console.log('[DELETE] /api/live-streams/:streamId/comments/:commentId - Deleted:', commentId);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('[DELETE] /api/live-streams/:streamId/comments/:commentId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/comments/:commentId (DELETE) loaded');

// POST /api/live-streams/:streamId/comments/:commentId/like - Like comment
app.post('/api/live-streams/:streamId/comments/:commentId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const { streamId, commentId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    const db = mongoose.connection.db;
    const liveStreamCommentsCollection = db.collection('livestream_comments');
    
    const comment = await liveStreamCommentsCollection.findOne({ 
      _id: toObjectId(commentId)
    });
    
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    const likes = comment.likes || [];
    if (likes.includes(userId)) {
      return res.status(400).json({ success: false, error: 'Already liked' });
    }
    
    likes.push(userId);
    const updated = await liveStreamCommentsCollection.findOneAndUpdate(
      { _id: toObjectId(commentId) },
      { $set: { likes, likesCount: likes.length } },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/live-streams/:streamId/comments/:commentId/like - User', userId, 'liked');
    res.json({ success: true, data: { likes: updated.value.likes, likesCount: updated.value.likesCount } });
  } catch (err) {
    console.error('[POST] /api/live-streams/:streamId/comments/:commentId/like error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/comments/:commentId/like (POST) loaded');

// POST /api/live-streams/:streamId/comments/:commentId/reactions - React to comment
app.post('/api/live-streams/:streamId/comments/:commentId/reactions', async (req, res) => {
  try {
    const { userId, reaction } = req.body;
    const { streamId, commentId } = req.params;
    
    if (!userId || !reaction) {
      return res.status(400).json({ success: false, error: 'userId and reaction required' });
    }
    
    const db = mongoose.connection.db;
    const liveStreamCommentsCollection = db.collection('livestream_comments');
    
    const comment = await liveStreamCommentsCollection.findOne({ 
      _id: toObjectId(commentId)
    });
    
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    const reactions = comment.reactions || {};
    reactions[reaction] = reactions[reaction] || [];
    
    if (!reactions[reaction].includes(userId)) {
      reactions[reaction].push(userId);
    }
    
    const updated = await liveStreamCommentsCollection.findOneAndUpdate(
      { _id: toObjectId(commentId) },
      { $set: { reactions } },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/live-streams/:streamId/comments/:commentId/reactions - User', userId, 'reacted:', reaction);
    res.json({ success: true, data: { reactions: updated.value.reactions } });
  } catch (err) {
    console.error('[POST] /api/live-streams/:streamId/comments/:commentId/reactions error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/live-streams/:streamId/comments/:commentId/reactions (POST) loaded');

console.log('✅ Critical inline routes registered: /api/posts, /api/categories, /api/live-streams');

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Trave Social Backend' }));
app.get('/api/status', (req, res) => res.json({ success: true, status: 'online' }));

// Media upload endpoint - with multer middleware for multipart/form-data
app.post('/api/media/upload', async (req, res) => {
  try {
    const { file: fileBase64, fileName, image, path } = req.body;
    
    // Support both { file, fileName } and { image, path } formats
    let mediaFile = fileBase64 || image;
    const mediaName = fileName || path || 'media';
    
    console.log('[POST] /api/media/upload - Received request');
    console.log('[POST] /api/media/upload - Content-Type:', req.headers['content-type']);
    console.log('[POST] /api/media/upload - mediaFile (base64) length:', mediaFile?.length || 0);
    console.log('[POST] /api/media/upload - mediaName:', mediaName);
    console.log('[POST] /api/media/upload - req.file exists:', !!req.file);
    
    // Support multipart/form-data with file upload
    if (!mediaFile && req.file) {
      // Convert buffer to base64 for Cloudinary
      mediaFile = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      console.log('[POST] /api/media/upload - Using req.file buffer, size:', req.file.size, 'bytes');
    }
    
    if (!mediaFile) {
      console.error('[POST] /api/media/upload - No file/image provided');
      return res.status(400).json({ success: false, error: 'No file/image provided' });
    }

    // Ensure data URI format for Cloudinary
    if (!mediaFile.startsWith('data:')) {
      // Add data URI prefix if not present
      mediaFile = `data:image/jpeg;base64,${mediaFile}`;
      console.log('[POST] /api/media/upload - Added data URI prefix');
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
    return res.json({ 
      success: true, 
      data: { 
        url: result.secure_url, 
        fileName: mediaName,
        secureUrl: result.secure_url
      },
      url: result.secure_url
    });
  } catch (err) {
    console.error('[POST] /api/media/upload - ❌ Error:', err.message);
    console.error('[POST] /api/media/upload - Stack:', err.stack);
    return res.status(500).json({ success: false, error: err.message || 'Upload failed' });
  }
});
console.log('  ✅ /api/media/upload loaded (with Cloudinary)');

// ============= INLINE ROUTES FOR MISSING ENDPOINTS =============

// GET /api/conversations - Get conversations for current user
app.get('/api/conversations', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    
    console.log('[GET] /api/conversations - Query userId:', userId);
    
    // Return empty if no userId
    if (!userId) {
      console.warn('[GET] /api/conversations - No userId provided');
      return res.json({ success: true, data: [] });
    }
    
    const db = mongoose.connection.db;
    
    // Build query for conversations
    const query = { 
      $or: [
        { userId1: userId }, 
        { userId2: userId },
        { participants: { $in: [userId] } }
      ]
    };
    
    console.log('[GET] /api/conversations - Query:', JSON.stringify(query));
    
    // First, let's log ALL conversations in the database for debugging
    const allConversations = await db.collection('conversations').find({}).limit(5).toArray();
    console.log('[GET] Total conversations in DB:', allConversations.length);
    allConversations.forEach((conv, i) => {
      console.log(`  [${i}] participants:`, conv.participants, '| user in participants?', conv.participants?.includes(userId));
    });
    
    // Query with index optimization
    const conversations = await db.collection('conversations')
      .find(query)
      .maxTimeMS(5000)  // 5 second timeout
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    
    console.log('[GET] /api/conversations - Found', conversations.length, 'conversations');
    conversations.forEach((c, i) => {
      console.log(`  [${i}] participants:`, c.participants, '| lastMessage:', c.lastMessage?.substring(0, 30));
    });
    
    // Add currentUserId to each conversation for frontend compatibility
    const conversationsWithUserId = conversations.map(conv => ({
      ...conv,
      currentUserId: userId
    }));
    
    res.json({ success: true, data: conversationsWithUserId || [] });
  } catch (err) {
    console.error('[GET] /api/conversations - Error:', err.message);
    res.json({ success: true, data: [] });
  }
});
console.log('  ✅ /api/conversations loaded');

// DEBUG ENDPOINT: GET /api/debug/conversations-count - Check conversation count
app.get('/api/debug/conversations-count', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const count = await db.collection('conversations').countDocuments({});
    const capitalizedCount = await db.collection('Conversation').countDocuments({}).catch(() => 0);
    
    const sample = await db.collection('conversations').find({}).limit(3).toArray();
    
    res.json({ 
      success: true, 
      'conversations (lowercase)': count,
      'Conversation (capitalized)': capitalizedCount,
      'sample documents': sample
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DEBUG ENDPOINT: GET /api/debug/messages-count - Check message count
app.get('/api/debug/messages-count', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const count = await db.collection('messages').countDocuments({});
    const sample = await db.collection('messages').find({}).sort({ createdAt: -1 }).limit(3).toArray();
    
    res.json({ 
      success: true, 
      'total messages': count,
      'recent messages': sample.map(m => ({ ...m, text: m.text?.substring(0, 30) }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DEBUG ENDPOINT: POST /api/test/create-conversation - Create test conversation
app.post('/api/test/create-conversation', async (req, res) => {
  try {
    const { userId1, userId2, lastMessage } = req.body;
    
    if (!userId1 || !userId2) {
      return res.status(400).json({ success: false, error: 'userId1 and userId2 required' });
    }
    
    const db = mongoose.connection.db;
    const convo = {
      userId1,
      userId2,
      participants: [userId1, userId2],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessage: lastMessage || 'Hello!',
      lastMessageTime: new Date()
    };
    
    const result = await db.collection('conversations').insertOne(convo);
    console.log('✅ TEST: Created conversation:', result.insertedId);
    
    res.json({ success: true, data: { _id: result.insertedId, ...convo } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/test/create-conversation loaded');

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

// POST /api/conversations/:conversationId/messages - Send message
app.post('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { senderId, text, recipientId } = req.body;
    console.log('[POST] /api/conversations - Received:', { senderId, text: text.substring(0, 50), recipientId });
    
    if (!senderId || !text) {
      return res.status(400).json({ success: false, error: 'senderId and text required' });
    }
    
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    const conversationsCollection = db.collection('conversations'); // Use lowercase for consistency
    
    // Extract participants from conversationId (format: userId1_userId2)
    let participants = [];
    if (req.params.conversationId.includes('_')) {
      participants = req.params.conversationId.split('_');
    } else if (recipientId && senderId) {
      // If recipientId provided, use it
      participants = [senderId, recipientId];
    }
    
    console.log('[POST] Extracted participants:', participants);
    
    // Sort participants for consistent conversation ID
    if (participants.length === 2) {
      participants = [participants[0], participants[1]].sort();
    }
    
    console.log('[POST] Sorted participants:', participants);
    
    const newMessage = {
      conversationId: req.params.conversationId,
      senderId,
      text,
      createdAt: new Date(),
      reactions: {},
      replies: []
    };
    
    const result = await messagesCollection.insertOne(newMessage);
    console.log('[POST] Message inserted:', result.insertedId);
    
    // Update or create conversation record
    if (participants.length === 2) {
      console.log('[POST] Upserting conversation for:', participants);
      
      try {
        // First, try to find if conversation exists
        const existing = await conversationsCollection.findOne({
          participants: { $all: participants }
        });
        
        if (existing) {
          // Update existing conversation
          await conversationsCollection.updateOne(
            { _id: existing._id },
            {
              $set: {
                lastMessage: text,
                lastMessageAt: new Date(),
                updatedAt: new Date()
              }
            }
          );
          console.log('[POST] Updated existing conversation:', existing._id);
        } else {
          // Create new conversation
          const insertResult = await conversationsCollection.insertOne({
            participants: participants,
            lastMessage: text,
            lastMessageAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log('[POST] Created new conversation:', insertResult.insertedId);
        }
      } catch (convErr) {
        console.error('[POST] Conversation creation error:', convErr.message);
      }
    } else {
      console.warn('[POST] Could not extract participants, skipping conversation creation');
    }
    
    return res.status(201).json({ success: true, id: result.insertedId, data: newMessage });
  } catch (err) {
    console.error('[POST] /api/conversations/:conversationId/messages error:', err.message);
    console.error('[POST] Error stack:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages (POST) loaded');

// GET /api/conversations/:conversationId/messages - Get messages in conversation
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    
    const messages = await messagesCollection
      .find({ conversationId: req.params.conversationId })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('[GET] /api/conversations/:conversationId/messages - Found:', messages.length);
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('[GET] /api/conversations/:conversationId/messages error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages (GET) loaded');

// GET /api/conversations/:conversationId/messages/:messageId - Get single message
app.get('/api/conversations/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    
    const message = await messagesCollection.findOne({ 
      _id: toObjectId(req.params.messageId)
    });
    
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('[GET] /api/conversations/:conversationId/messages/:messageId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages/:messageId (GET) loaded');

// PATCH /api/conversations/:conversationId/messages/:messageId - Edit message
app.patch('/api/conversations/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const { conversationId, messageId } = req.params;
    
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'userId and text required' });
    }
    
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    
    const message = await messagesCollection.findOne({ _id: toObjectId(messageId) });
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized - you can only edit your own messages' });
    }
    
    const updated = await messagesCollection.findOneAndUpdate(
      { _id: toObjectId(messageId) },
      { $set: { text, editedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    console.log('[PATCH] /api/conversations/:conversationId/messages/:messageId - Updated:', messageId);
    res.json({ success: true, data: updated.value });
  } catch (err) {
    console.error('[PATCH] /api/conversations/:conversationId/messages/:messageId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages/:messageId (PATCH) loaded');

// DELETE /api/conversations/:conversationId/messages/:messageId - Delete message
app.delete('/api/conversations/:conversationId/messages/:messageId', async (req, res) => {
  try {
    const { userId } = req.body;
    const { messageId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    
    const message = await messagesCollection.findOne({ _id: toObjectId(messageId) });
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized - you can only delete your own messages' });
    }
    
    await messagesCollection.deleteOne({ _id: toObjectId(messageId) });
    
    console.log('[DELETE] /api/conversations/:conversationId/messages/:messageId - Deleted:', messageId);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    console.error('[DELETE] /api/conversations/:conversationId/messages/:messageId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages/:messageId (DELETE) loaded');

// POST /api/conversations/:conversationId/messages/:messageId/reactions - React to message
app.post('/api/conversations/:conversationId/messages/:messageId/reactions', async (req, res) => {
  try {
    const { userId, reaction } = req.body;
    const { messageId } = req.params;
    
    if (!userId || !reaction) {
      return res.status(400).json({ success: false, error: 'userId and reaction required' });
    }
    
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    
    const message = await messagesCollection.findOne({ _id: toObjectId(messageId) });
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    const reactions = message.reactions || {};
    reactions[reaction] = reactions[reaction] || [];
    
    if (!reactions[reaction].includes(userId)) {
      reactions[reaction].push(userId);
    }
    
    const updated = await messagesCollection.findOneAndUpdate(
      { _id: toObjectId(messageId) },
      { $set: { reactions } },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/conversations/:conversationId/messages/:messageId/reactions - User', userId, 'reacted:', reaction);
    res.json({ success: true, data: { reactions: updated.value.reactions } });
  } catch (err) {
    console.error('[POST] /api/conversations/:conversationId/messages/:messageId/reactions error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages/:messageId/reactions (POST) loaded');

// POST /api/conversations/:conversationId/messages/:messageId/replies - Reply to message
app.post('/api/conversations/:conversationId/messages/:messageId/replies', async (req, res) => {
  try {
    const { senderId, text } = req.body;
    const { messageId } = req.params;
    
    if (!senderId || !text) {
      return res.status(400).json({ success: false, error: 'senderId and text required' });
    }
    
    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');
    
    const parentMessage = await messagesCollection.findOne({ _id: toObjectId(messageId) });
    if (!parentMessage) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    const reply = {
      _id: new mongoose.Types.ObjectId(),
      senderId,
      text,
      createdAt: new Date(),
      reactions: {}
    };
    
    const replies = parentMessage.replies || [];
    replies.push(reply);
    
    const updated = await messagesCollection.findOneAndUpdate(
      { _id: toObjectId(messageId) },
      { $set: { replies } },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/conversations/:conversationId/messages/:messageId/replies - Added reply:', reply._id);
    res.status(201).json({ success: true, id: reply._id, data: reply });
  } catch (err) {
    console.error('[POST] /api/conversations/:conversationId/messages/:messageId/replies error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/conversations/:conversationId/messages/:messageId/replies (POST) loaded');

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

// DELETE /api/stories/:storyId - Delete a story
app.delete('/api/stories/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { userId } = req.body;
    
    console.log(`🗑️ DELETE /api/stories/${storyId} called with userId:`, userId);
    
    if (!storyId) {
      return res.status(400).json({ success: false, error: 'storyId required' });
    }

    const db = mongoose.connection.db;
    const ObjectId = require('mongodb').ObjectId;
    
    // Find the story
    let storyId_obj;
    try {
      storyId_obj = new ObjectId(storyId);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid storyId format' });
    }
    
    const story = await db.collection('stories').findOne({ _id: storyId_obj });
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    // Verify ownership (if userId provided)
    if (userId && story.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this story' });
    }

    // Delete the story
    const result = await db.collection('stories').deleteOne({ _id: storyId_obj });
    
    if (result.deletedCount > 0) {
      res.json({ success: true, message: 'Story deleted successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to delete story' });
    }
  } catch (err) {
    console.error('❌ DELETE /api/stories error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/stories/:storyId (DELETE) loaded');

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
    const targetUser = await usersCollection.findOne({ _id: toObjectId(userId) });
    
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
    
    console.log('[GET] /api/users/:userId/sections - userId:', userId, 'requesterUserId:', requesterUserId);
    
    const db = mongoose.connection.db;
    const sectionsCollection = db.collection('sections');
    const sections = await sectionsCollection
      .find({ userId: userId })
      .sort({ order: 1 })
      .toArray();
    
    console.log('[GET] /api/users/:userId/sections - Found', sections.length, 'sections for user:', userId);
    
    res.json({ success: true, data: sections || [] });
  } catch (err) {
    console.error('[GET] /api/users/:userId/sections error:', err.message);
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

    console.log('[POST] /api/users/:userId/sections - Creating section for userId:', userId, 'name:', name);

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

    console.log('[POST] /api/users/:userId/sections - Created section:', sectionData._id, 'for user:', userId);
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

// Passport routes
try {
  app.use('/api', require('../routes/passport'));
  console.log('  ✅ /api/passport loaded');
} catch (err) {
  console.warn('  ⚠️ /api/passport error:', err.message);
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

// Upload routes
try {
  app.use('/api/upload', require('../routes/upload'));
  console.log('  ✅ /api/upload loaded');
} catch (err) {
  console.warn('  ⚠️ /api/upload error:', err.message);
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
    const db = mongoose.connection.db;
    const commentsCollection = db.collection('comments');
    
    // Convert postId to string for comparison (MongoDB stores IDs as strings in some cases)
    const postIdStr = req.params.postId;
    const postIdObj = toObjectId(postIdStr);
    
    const comments = await commentsCollection
      .find({ 
        $or: [
          { postId: postIdStr },
          { postId: postIdObj }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error('[GET] /api/posts/:postId/comments error:', err.message);
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// Add comment to post
app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { userId, text, userName, userAvatar } = req.body;
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'Missing userId or text' });
    }
    
    const db = mongoose.connection.db;
    const commentsCollection = db.collection('comments');
    
    const newComment = {
      postId: req.params.postId,  // Store as string, DB will handle it
      userId,
      userName: userName || 'Anonymous',
      userAvatar: userAvatar || null,
      text,
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: [],
      likesCount: 0,
      reactions: {},
      replies: []
    };
    
    const result = await commentsCollection.insertOne(newComment);
    
    // Update post's commentCount
    try {
      const Post = mongoose.model('Post');
      const post = await Post.findById(req.params.postId);
      if (post) {
        post.commentsCount = (post.commentsCount || 0) + 1;
        post.commentCount = (post.commentCount || 0) + 1;
        await post.save();
        console.log('[POST] /api/posts/:postId/comments - Updated post commentCount to:', post.commentsCount);
      }
    } catch (err) {
      console.log('[POST] /api/posts/:postId/comments - Could not update commentCount:', err.message);
    }
    
    console.log('[POST] /api/posts/:postId/comments - Created comment:', result.insertedId);
    return res.status(201).json({ 
      success: true, 
      id: result.insertedId, 
      data: { ...newComment, _id: result.insertedId } 
    });
  } catch (err) {
    console.error('[POST] /api/posts/:postId/comments error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/comments (POST) loaded');

// PATCH /api/posts/:postId/comments/:commentId - Edit comment
app.patch('/api/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const { postId, commentId } = req.params;
    
    if (!userId || !text) {
      return res.status(400).json({ success: false, error: 'Missing userId or text' });
    }
    
    const db = mongoose.connection.db;
    const commentsCollection = db.collection('comments');
    
    // Check if comment exists and belongs to user
    const comment = await commentsCollection.findOne({ 
      _id: toObjectId(commentId),
      postId: postId
    });
    
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    if (comment.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized - you can only edit your own comments' });
    }
    
    const updated = await commentsCollection.findOneAndUpdate(
      { _id: toObjectId(commentId) },
      { 
        $set: { 
          text, 
          editedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    console.log('[PATCH] /api/posts/:postId/comments/:commentId - Updated:', commentId);
    res.json({ success: true, data: updated.value });
  } catch (err) {
    console.error('[PATCH] /api/posts/:postId/comments/:commentId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/comments/:commentId (PATCH) loaded');

// DELETE /api/posts/:postId/comments/:commentId - Delete comment
app.delete('/api/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    const { userId } = req.body;
    const { postId, commentId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const db = mongoose.connection.db;
    const commentsCollection = db.collection('comments');
    
    // Check if comment exists and belongs to user
    const comment = await commentsCollection.findOne({ 
      _id: toObjectId(commentId),
      postId: postId
    });
    
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    if (comment.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized - you can only delete your own comments' });
    }
    
    await commentsCollection.deleteOne({ _id: toObjectId(commentId) });
    
    console.log('[DELETE] /api/posts/:postId/comments/:commentId - Deleted:', commentId);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('[DELETE] /api/posts/:postId/comments/:commentId error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/comments/:commentId (DELETE) loaded');

// POST /api/posts/:postId/comments/:commentId/like - Like a comment
app.post('/api/posts/:postId/comments/:commentId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const { postId, commentId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const db = mongoose.connection.db;
    const commentsCollection = db.collection('comments');
    
    const comment = await commentsCollection.findOne({ _id: toObjectId(commentId) });
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    const likes = comment.likes || [];
    if (likes.includes(userId)) {
      return res.status(400).json({ success: false, error: 'Already liked' });
    }
    
    likes.push(userId);
    const updated = await commentsCollection.findOneAndUpdate(
      { _id: toObjectId(commentId) },
      { $set: { likes, likesCount: likes.length } },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/posts/:postId/comments/:commentId/like - User', userId, 'liked comment');
    res.json({ success: true, data: { likes: updated.value.likes, likesCount: updated.value.likesCount } });
  } catch (err) {
    console.error('[POST] /api/posts/:postId/comments/:commentId/like error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/comments/:commentId/like (POST) loaded');

// POST /api/posts/:postId/comments/:commentId/reactions - Add reaction to comment
app.post('/api/posts/:postId/comments/:commentId/reactions', async (req, res) => {
  try {
    const { userId, reaction } = req.body;
    const { postId, commentId } = req.params;
    
    if (!userId || !reaction) {
      return res.status(400).json({ success: false, error: 'userId and reaction required' });
    }
    
    const db = mongoose.connection.db;
    const commentsCollection = db.collection('comments');
    
    const comment = await commentsCollection.findOne({ _id: toObjectId(commentId) });
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    
    const reactions = comment.reactions || {};
    reactions[reaction] = reactions[reaction] || [];
    
    if (!reactions[reaction].includes(userId)) {
      reactions[reaction].push(userId);
    }
    
    const updated = await commentsCollection.findOneAndUpdate(
      { _id: toObjectId(commentId) },
      { $set: { reactions } },
      { returnDocument: 'after' }
    );
    
    console.log('[POST] /api/posts/:postId/comments/:commentId/reactions - User', userId, 'reacted:', reaction);
    res.json({ success: true, data: { reactions: updated.value.reactions } });
  } catch (err) {
    console.error('[POST] /api/posts/:postId/comments/:commentId/reactions error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/comments/:commentId/reactions (POST) loaded');

// POST /api/posts/:postId/like - Like a post
app.post('/api/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    console.log('[POST] /api/posts/:postId/like called - postId:', postId, 'userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const Post = mongoose.model('Post');
    const post = await Post.findById(postId);
    
    console.log('[POST] /api/posts/:postId/like - Found post:', !!post, 'existing likes:', post?.likes?.length || 0);
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    if (!post.likes) post.likes = [];
    
    // Check if already liked
    if (post.likes.includes(userId)) {
      console.log('[POST] /api/posts/:postId/like - Already liked');
      return res.status(400).json({ success: false, error: 'Already liked' });
    }
    
    post.likes.push(userId);
    const savedPost = await post.save();
    
    console.log('[POST] /api/posts/:postId/like - User', userId, 'liked post', postId, 'new total:', savedPost.likes.length);
    return res.json({ success: true, data: { likes: savedPost.likes, total: savedPost.likes.length } });
  } catch (err) {
    console.error('[POST] /api/posts/:postId/like error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/like (POST) loaded');

// DELETE /api/posts/:postId/like - Unlike a post
app.delete('/api/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    console.log('[DELETE] /api/posts/:postId/like called - postId:', postId, 'userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const Post = mongoose.model('Post');
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    if (!post.likes) post.likes = [];
    
    // Check if liked
    if (!post.likes.includes(userId)) {
      console.log('[DELETE] /api/posts/:postId/like - Not liked');
      return res.status(400).json({ success: false, error: 'Not liked' });
    }
    
    post.likes = post.likes.filter(id => id !== userId);
    const savedPost = await post.save();
    
    console.log('[DELETE] /api/posts/:postId/like - User', userId, 'unliked post', postId, 'new total:', savedPost.likes.length);
    return res.json({ success: true, data: { likes: savedPost.likes, total: savedPost.likes.length } });
  } catch (err) {
    console.error('[DELETE] /api/posts/:postId/like error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
console.log('  ✅ /api/posts/:postId/like (DELETE) loaded');

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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
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