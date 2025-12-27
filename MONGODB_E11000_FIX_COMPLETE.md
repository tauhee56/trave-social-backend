# MongoDB E11000 Duplicate Key Error - FIXED ✅

## Problem Summary
When attempting to register a new user via the Firebase authentication endpoint, MongoDB was throwing:
```
MongoServerError: E11000 duplicate key error collection: travesocial.users index: uid_1 dup key: { uid: null }
```

## Root Cause
Multiple conflicting User schema definitions existed across the backend:
- **src/routes/auth.js**: Defined its own User schema with firebaseUid field
- **routes/users.js**: Defined a different User schema WITHOUT firebaseUid field
- **models/User.js**: Centralized User model that was never being imported/used
- **Result**: MongoDB was creating conflicting unique indexes (uid_1), and null values violated the unique constraint

## Solution Implemented

### 1. Unified User Schema (both auth.js and users.js)
Both route files now use the centralized User model with:
- `firebaseUid`: String with sparse: true (allows multiple null values)
- `email`: Unique required string
- `displayName`, `avatar`, `bio`: Optional fields
- `followers`, `following`: Counters (default: 0)

### 2. Automatic Index Cleanup on Server Startup
Added to `src/index.js`:
```javascript
// On MongoDB connection, drop conflicting indexes
const usersCollection = db.collection('users');
const indexes = await usersCollection.listIndexes().toArray();
for (const index of indexes) {
  if (index.name !== '_id_' && (index.name === 'uid_1' || (index.key && index.key.uid))) {
    await usersCollection.dropIndex(index.name);
    console.log(`✓ Dropped conflicting index: ${index.name}`);
  }
}
```

## Files Modified

1. **trave-social-backend/src/routes/auth.js**
   - Changed to use centralized User model with try/catch fallback
   - Ensures firebaseUid, email, displayName fields are set

2. **trave-social-backend/routes/users.js**
   - Changed to use same centralized User model
   - Consistent schema across all routes

3. **trave-social-backend/src/index.js**
   - Added automatic index cleanup on MongoDB connection
   - Drops uid_1 index that was causing the error

## Testing Results ✅

### Registration Test
```
POST /api/auth/register-firebase
Status: 200 OK
Response: {
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "694e904ddd36f71117e85d48",
    "firebaseUid": "test-uid-1766756428812",
    "email": "testuser@example.com",
    "displayName": "Test User",
    "avatar": "https://example.com/avatar.jpg"
  }
}
```

### Login Test
```
POST /api/auth/login-firebase
Status: 200 OK
Response: { success: true, token: "...", user: {...} }
```

## Impact
- ✅ User registration now works without E11000 errors
- ✅ Firebase UID properly synced to MongoDB
- ✅ JWT tokens generated successfully
- ✅ Full authentication flow (register → login → navigate) ready for testing

## Next Steps
1. Test the full flow on the physical device:
   - Launch app
   - Register with new email
   - Verify successful login and navigation to home screen
   - Verify token persisted in AsyncStorage
   - Test logout and re-login

2. Monitor MongoDB for any remaining schema conflicts:
   - Collection should have only _id_ and email indexes
   - firebaseUid field should exist (sparse, non-unique)

## Validation Command
To verify the indexes are correct, you can run:
```javascript
db.users.getIndexes()
// Should return only:
// - _id_ index (default)
// - email_1 index (unique, sparse)
```
