# Trave Social Backend - API Testing Guide

## Quick Start

1. Start the backend server:
```bash
cd trave-social-backend
npm start
```

2. Server should be running on `http://localhost:3000`

## Test Endpoints with cURL or Postman

### 1. Test Story Creation with User Data Population

```bash
# Create a story (backend will auto-populate user data)
curl -X POST http://localhost:3000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "mediaUrl": "https://example.com/image.jpg",
    "mediaType": "image",
    "caption": "My awesome story!"
  }'

# Expected: Story created with userName and userAvatar populated from User collection
```

### 2. Test Profile Sections CRUD

```bash
# Create a section
curl -X POST http://localhost:3000/api/sections \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "name": "Travel Photos",
    "coverImage": "https://example.com/cover.jpg"
  }'

# Update a section
curl -X PATCH http://localhost:3000/api/sections/SECTION_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Travel Photos",
    "coverImage": "https://example.com/new-cover.jpg"
  }'

# Delete a section
curl -X DELETE http://localhost:3000/api/sections/SECTION_ID

# Get user sections
curl http://localhost:3000/api/sections?userId=test-user-123
```

### 3. Test User Search (Excluding Self)

```bash
# Search users (will exclude requesterUserId from results)
curl "http://localhost:3000/api/users/search?q=john&requesterUserId=test-user-123&limit=20"

# Expected: Results will NOT include test-user-123
```

### 4. Test Follow System with Private Accounts

```bash
# Send follow request (for private accounts)
curl -X POST http://localhost:3000/api/follow/request \
  -H "Content-Type: application/json" \
  -d '{
    "fromUserId": "user-1",
    "toUserId": "user-2"
  }'

# Get pending follow requests
curl http://localhost:3000/api/follow/requests/user-2

# Accept follow request
curl -X POST http://localhost:3000/api/follow/request/REQUEST_ID/accept

# Reject follow request
curl -X DELETE http://localhost:3000/api/follow/request/REQUEST_ID

# Check if follow request exists
curl "http://localhost:3000/api/follow/request/check?fromUserId=user-1&toUserId=user-2"
```

### 5. Test Comment Reactions

```bash
# React to a comment with emoji
curl -X POST http://localhost:3000/api/posts/POST_ID/comments/COMMENT_ID/react \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "emoji": "😂"
  }'

# Expected response includes:
# - reactionCount: total number of reactions
# - reactions: object with emoji keys and user ID arrays

# Get reactions for a comment
curl http://localhost:3000/api/posts/POST_ID/comments/COMMENT_ID/reactions

# Like a comment
curl -X POST http://localhost:3000/api/posts/POST_ID/comments/COMMENT_ID/like \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1"
  }'

# Unlike a comment
curl -X DELETE http://localhost:3000/api/posts/POST_ID/comments/COMMENT_ID/like \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1"
  }'
```

### 6. Test Inbox with User Data Population

```bash
# Get conversations (with populated participant data)
curl "http://localhost:3000/api/conversations?userId=user-1"

# Expected: Each conversation includes otherParticipant object with:
# - id: participant user ID
# - name: participant display name
# - avatar: participant avatar URL

# Get messages (with populated sender data)
curl http://localhost:3000/api/conversations/CONVERSATION_ID/messages

# Expected: Each message includes:
# - senderName: sender's display name
# - senderAvatar: sender's avatar URL
```

### 7. Test Story Visibility Filtering

```bash
# Get stories (filtered by privacy and follow relationships)
curl "http://localhost:3000/api/stories?userId=user-1"

# Expected: Only returns stories from:
# - Public users
# - Users that user-1 follows
# - User-1's friends
```

## Testing with Postman

### Import Collection

Create a Postman collection with these requests:

1. **Stories**
   - POST Create Story
   - GET Get Stories

2. **Sections**
   - POST Create Section
   - GET Get Sections
   - PATCH Update Section
   - DELETE Delete Section
   - PATCH Update Section Order

3. **Users**
   - GET Search Users

4. **Follow**
   - POST Follow User
   - DELETE Unfollow User
   - POST Send Follow Request
   - POST Accept Follow Request
   - DELETE Reject Follow Request
   - GET Get Follow Requests
   - GET Check Follow Request

5. **Comments**
   - POST React to Comment
   - GET Get Reactions
   - POST Like Comment
   - DELETE Unlike Comment

6. **Inbox**
   - GET Get Conversations
   - GET Get Messages

### Environment Variables

Set these in Postman:
- `baseUrl`: `http://localhost:3000`
- `userId`: Your test user ID
- `postId`: A test post ID
- `commentId`: A test comment ID
- `sectionId`: A test section ID

## Verification Checklist

- [ ] Stories populate user data automatically
- [ ] Sections can be created, updated, and deleted
- [ ] User search excludes current user
- [ ] Follow requests work for private accounts
- [ ] Comment reactions update counts correctly
- [ ] Inbox shows user profiles
- [ ] Story visibility respects privacy settings
- [ ] All endpoints return proper error messages

## Common Issues

### Issue: "User not found" in stories
**Solution**: Make sure the userId exists in the users collection

### Issue: Sections disappear after update
**Solution**: Use the PATCH endpoint, not POST

### Issue: Self profile appears in search
**Solution**: Pass requesterUserId parameter

### Issue: Follow request fails
**Solution**: Check if user is already following or request already exists

### Issue: Reactions don't update
**Solution**: Make sure to use the correct emoji format (UTF-8)

## Database Verification

Check MongoDB directly:

```bash
# Connect to MongoDB
mongosh

# Use your database
use trave-social

# Check stories have user data
db.stories.find().pretty()

# Check sections
db.sections.find().pretty()

# Check follow requests
db.followrequests.find().pretty()

# Check comments with reactions
db.comments.find().pretty()
```

## Next Steps

After verifying all endpoints work:
1. Update frontend to use new endpoints
2. Test end-to-end user flows
3. Monitor backend logs for errors
4. Optimize database queries if needed

