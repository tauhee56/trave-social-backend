const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  caption: { type: String },
  imageUrl: String,
  mediaUrls: { type: [String], default: [] },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  location: String,
  locationData: {
    name: String,
    address: String,
    placeId: String,
    lat: Number,
    lon: Number,
    verified: Boolean
  },
  category: String,
  hashtags: { type: [String], default: [] },
  mentions: { type: [String], default: [] },
  taggedUserIds: { type: [String], default: [] },
  likes: { type: [String], default: [] },
  likesCount: { type: Number, default: 0 },
  comments: { type: Array, default: [] }, // Array of comment objects (when stored in post)
  commentsCount: { type: Number, default: 0 }, // Cached count
  commentCount: { type: Number, default: 0 }, // Alias for frontend compatibility
  savedBy: { type: [String], default: [] }, // Array of user IDs who saved this post
  savesCount: { type: Number, default: 0 }, // Count of saves
  isPrivate: { type: Boolean, default: false }, // Privacy flag: true = private account post
  allowedFollowers: { type: [String], default: [] }, // Array of follower IDs who can see this private post
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);
