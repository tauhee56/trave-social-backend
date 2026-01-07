const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: { type: String, sparse: true, index: true }, // Firebase UID (optional, can be null for some users)
  email: { type: String, required: true, unique: true, lowercase: true }, // Email must be unique
  displayName: String,
  name: String,
  bio: String,
  website: String,
  avatar: String,
  photoURL: String,
  emailVerified: Boolean,
  createdAt: { type: Date, default: Date.now },
  followers: [String],
  following: [String],
  postsCount: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  isBanned: { type: Boolean, default: false },
  banReason: String,
  bannedAt: Date,
  isVerified: { type: Boolean, default: false },
  savedPosts: { type: [String], default: [] }, // Array of saved post IDs
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
