const Post = require('../models/Post');
const mongoose = require('mongoose');

// Create post
exports.createPost = async (req, res) => {
  try {
    const { userId, caption, imageUrls, hashtags, mentions, location } = req.body;
    
    if (!userId || !caption) {
      return res.status(400).json({ success: false, error: 'userId and caption required' });
    }
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const newPost = {
      userId,
      caption,
      imageUrls: imageUrls || [],
      likes: [],
      likesCount: 0,
      comments: [],
      commentsCount: 0,
      hashtags: hashtags || [],
      mentions: mentions || [],
      location: location || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await postsCollection.insertOne(newPost);
    
    res.status(201).json({ 
      success: true, 
      data: { ...newPost, _id: result.insertedId } 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all posts
exports.getAllPosts = async (req, res) => {
  try {
    // Query the posts collection directly from MongoDB
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const posts = await postsCollection.find({}).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ success: true, data: posts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
};

// Get post by ID
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    // Try to convert to ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const post = await postsCollection.findOne({ _id: objectId });
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
