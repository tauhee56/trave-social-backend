const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    // Password is required only for email/password auth
    // Optional if using Firebase only
  },
  displayName: {
    type: String,
    default: 'User',
  },
  avatar: {
    type: String,
    default: null,
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  pushToken: {
    type: String,
    default: null,
  },
  pushTokenUpdatedAt: {
    type: Date,
    default: null,
  },
  provider: {
    type: String,
    enum: ['email', 'google', 'apple', 'facebook'],
    default: 'email',
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Additional user info
  bio: {
    type: String,
    default: '',
  },
  followersCount: {
    type: Number,
    default: 0,
  },
  followingCount: {
    type: Number,
    default: 0,
  },
  location: {
    type: String,
    default: '',
  },
  website: {
    type: String,
    default: '',
  },
  phoneNumber: {
    type: String,
    default: '',
  },
  // Account settings
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  notificationsEnabled: {
    type: Boolean,
    default: true,
  },
  privacyLevel: {
    type: String,
    enum: ['public', 'private', 'followers'],
    default: 'public',
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
});

// Indexes for fast queries
UserSchema.index({ email: 1 });
UserSchema.index({ firebaseUid: 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
