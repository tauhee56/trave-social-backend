const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Start livestream
router.post('/', async (req, res) => {
  try {
    const { userId, title, description } = req.body;
    
    if (!userId || !title) {
      return res.status(400).json({ success: false, error: 'userId and title required' });
    }
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const livestream = {
      userId,
      title,
      description: description || '',
      isLive: true,
      viewers: [],
      viewerCount: 0,
      startedAt: new Date(),
      endedAt: null,
      likes: [],
      likesCount: 0
    };
    
    const result = await livestreamsCollection.insertOne(livestream);
    
    res.status(201).json({ 
      success: true, 
      data: { ...livestream, _id: result.insertedId } 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all active livestreams
router.get('/', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const livestreams = await livestreamsCollection
      .find({ isLive: true })
      .sort({ startedAt: -1 })
      .toArray();
    
    res.json({ success: true, data: livestreams || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// Get livestream by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const livestream = await livestreamsCollection.findOne({ _id: objectId });
    
    if (!livestream) {
      return res.status(404).json({ success: false, error: 'Livestream not found' });
    }
    
    res.json({ success: true, data: livestream });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// End livestream
router.put('/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const result = await livestreamsCollection.findOneAndUpdate(
      { _id: objectId },
      { 
        $set: { 
          isLive: false, 
          endedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Livestream not found' });
    }
    
    res.json({ success: true, data: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Join livestream (add viewer)
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, userAvatar } = req.body;
    
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const viewer = { 
      odId: userId, 
      name: userName, 
      avatar: userAvatar, 
      joinedAt: new Date() 
    };
    
    const result = await livestreamsCollection.findOneAndUpdate(
      { _id: objectId },
      { 
        $addToSet: { viewers: viewer },
        $inc: { viewerCount: 1 }
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ success: false, error: 'Livestream not found' });
    }
    
    res.json({ success: true, data: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Leave livestream (remove viewer)
router.post('/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const result = await livestreamsCollection.findOneAndUpdate(
      { _id: objectId },
      { 
        $pull: { viewers: { odId: userId } },
        $inc: { viewerCount: -1 }
      },
      { returnDocument: 'after' }
    );
    
    res.json({ success: true, data: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Like livestream
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const result = await livestreamsCollection.findOneAndUpdate(
      { _id: objectId },
      { 
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 }
      },
      { returnDocument: 'after' }
    );
    
    res.json({ success: true, data: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send comment in livestream
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, userAvatar, text } = req.body;
    
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const comment = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      userName,
      userAvatar,
      text,
      createdAt: new Date()
    };
    
    const result = await livestreamsCollection.findOneAndUpdate(
      { _id: objectId },
      { $push: { comments: comment } },
      { returnDocument: 'after' }
    );
    
    res.json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get livestream by user (broadcaster's current stream)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const db = mongoose.connection.db;
    const livestreamsCollection = db.collection('livestreams');
    
    const livestream = await livestreamsCollection.findOne({ 
      userId, 
      isLive: true 
    });
    
    res.json({ success: true, data: livestream });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
