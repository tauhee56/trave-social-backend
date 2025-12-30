const User = require('../models/User');
const Post = require('../models/Post');
const Highlight = require('../models/Highlight');
const Section = require('../models/Section');
const Story = require('../models/Story');

// Create or update user (for social login or registration)
exports.createOrUpdateUser = async (req, res) => {
  try {
    const { uid, email, displayName, name, avatar, provider } = req.body;
    if (!uid || !email) return res.status(400).json({ error: 'uid and email required' });
    const update = {
      email,
      displayName,
      name,
      avatar,
      photoURL: avatar,
      provider,
      updatedAt: new Date(),
    };
    const user = await User.findOneAndUpdate(
      { uid },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { uid } = req.params;
      const user = await User.findOne({
        $or: [
          { uid },
          { firebaseUid: uid },
          { _id: uid }
        ]
      });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user posts
exports.getUserPosts = async (req, res) => {
  try {
    const { uid } = req.params;
    const posts = await Post.find({ userId: uid }).sort({ createdAt: -1 });
    return res.json({ success: true, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get user highlights
exports.getUserHighlights = async (req, res) => {
  try {
    const { uid } = req.params;
    const highlights = await Highlight.find({ userId: uid }).sort({ createdAt: -1 });
    return res.json({ success: true, data: highlights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get user sections
exports.getUserSections = async (req, res) => {
  try {
    const { uid } = req.params;
    const sections = await Section.find({ userId: uid }).sort({ createdAt: -1 });
    return res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get user stories
exports.getUserStories = async (req, res) => {
  try {
    const { uid } = req.params;
    const stories = await Story.find({ userId: uid }).sort({ createdAt: -1 });
    return res.json({ success: true, data: stories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// List all users (for admin/testing)
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;
    
      const user = await User.findOneAndUpdate(
        { $or: [{ uid }, { firebaseUid: uid }, { _id: uid }] },
      { $set: { ...updateData, updatedAt: new Date() } },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Create section
exports.createSection = async (req, res) => {
  try {
    const { uid } = req.params;
    const section = req.body;
    
    if (!section.name) {
      return res.status(400).json({ success: false, error: 'Section name required' });
    }
    
    const newSection = new Section({
      userId: uid,
      ...section,
      createdAt: new Date()
    });
    
    await newSection.save();
    return res.json({ success: true, data: newSection });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update section
exports.updateSection = async (req, res) => {
  try {
    const { uid, sectionName } = req.params;
    const updateData = req.body;
    
    const section = await Section.findOneAndUpdate(
      { userId: uid, name: decodeURIComponent(sectionName) },
      { $set: { ...updateData, updatedAt: new Date() } },
      { new: true }
    );
    
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    return res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete section
exports.deleteSection = async (req, res) => {
  try {
    const { uid, sectionName } = req.params;
    
    const result = await Section.findOneAndDelete(
      { userId: uid, name: decodeURIComponent(sectionName) }
    );
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    return res.json({ success: true, message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Search users by name/username
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const users = await User.find({
      $or: [
        { displayName: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
      ]
    }).limit(20);
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
