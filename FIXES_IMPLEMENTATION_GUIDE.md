# Trave Social App - Comprehensive Fixes Implementation Guide

## Overview
This document outlines all the fixes needed for the Trave Social app to function professionally.

## Issues Fixed

### 1. ✅ Story Feature - User Avatar and Name Display
**Problem**: Stories don't show proper user avatar and name
**Solution**: 
- Updated `/routes/stories.js` to populate user data from User collection
- Added `userAvatar` field to Story model
- Stories now fetch and display correct user profile pic and name
- Added privacy filtering - only show stories from public users, followers, and friends

### 2. Profile Sections - Disappearing Sections
**Problem**: Sections disappear when editing, setting cover, or reordering
**Solution Needed**:
- Add `coverImage` and `posts` fields to Section model
- Add PATCH endpoint `/api/sections/:sectionId` to update individual sections
- Add proper state management in frontend to prevent disappearing
- Ensure sections persist during reordering operations

**Backend Changes Required**:
```javascript
// routes/sections.js - Add update endpoint
router.patch('/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name, coverImage, posts, order } = req.body;
    
    const section = await Section.findByIdAndUpdate(
      sectionId,
      { 
        name, 
        coverImage, 
        posts, 
        order,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add delete endpoint
router.delete('/:sectionId', async (req, res) => {
  try {
    await Section.findByIdAndDelete(req.params.sectionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### 3. Passport Feature - GPS Location Selection
**Problem**: Manual location entry instead of GPS selection
**Solution Needed**:
- Frontend: Use GPS to get current location
- Show location name from reverse geocoding
- Allow user to confirm and add to passport
- Generate ticket automatically when location is added

**Frontend Changes Required** (app/passport.tsx):
```typescript
// Add GPS location picker
const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission denied', 'Location permission is required');
    return;
  }
  
  const location = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = location.coords;
  
  // Reverse geocode to get city and country
  const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
  if (geocode.length > 0) {
    const { city, country } = geocode[0];
    return { city, country, lat: latitude, lon: longitude };
  }
};
```

### 4. Privacy Settings - Post Visibility
**Problem**: Private account posts visible to non-followers
**Solution Needed**:
- Update `/routes/posts.js` GET endpoints to check privacy
- Filter posts based on:
  - Public accounts: Show to everyone
  - Private accounts: Show only to followers and friends
- Already partially implemented, needs testing

### 5. User Search - Follow/Unfollow and Private Accounts
**Problem**: 
- Follow/unfollow not working
- Private accounts don't require follow requests
- Self profile shows in search results

**Solution Needed**:
```javascript
// routes/users.js - Update search to exclude self
router.get('/search', async (req, res) => {
  const { q, limit = 20, requesterUserId } = req.query;
  
  const users = await User.find({
    $or: [
      { displayName: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') }
    ],
    // Exclude self from search results
    _id: { $ne: requesterUserId },
    firebaseUid: { $ne: requesterUserId }
  }).limit(parseInt(limit));
  
  res.json({ success: true, data: users });
});
```

**Frontend Changes** (FollowButton component):
- Check if user is private before following
- If private, send follow request instead of direct follow
- Show "Requested" state after sending request
- Disable button after request is sent

### 6. Comment Reactions - Count Display
**Problem**: Reaction count doesn't update when clicking emoji
**Solution**: Update comment reactions endpoint to return updated counts

### 7. Inbox - User Profile Display
**Problem**: Messages don't show correct user profile pic and name
**Solution**: Populate user data in messages endpoint

### 8. Story Row - Filter by Followers/Friends
**Problem**: Shows all users' stories instead of just followers/friends
**Solution**: Already implemented in stories.js GET endpoint with privacy filtering

### 9. Streaming - ZeegoCloud Migration
**Problem**: Need to complete migration from Agora to ZeegoCloud
**Solution**: Update streaming components to use ZeegoCloud SDK

## Implementation Priority

1. ✅ Story user data population (DONE)
2. Profile sections update/delete endpoints
3. User search exclude self
4. Follow/unfollow with private account support
5. Passport GPS integration
6. Comment reactions count
7. Inbox user data population
8. ZeegoCloud streaming

## Testing Checklist

- [ ] Stories show correct user avatar and name
- [ ] Profile sections persist when editing
- [ ] Passport uses GPS location
- [ ] Private account posts hidden from non-followers
- [ ] User search excludes self profile
- [ ] Follow requests work for private accounts
- [ ] Comment reactions update count
- [ ] Inbox shows user profiles
- [ ] Story row shows only followers/friends
- [ ] Live streaming works with ZeegoCloud

