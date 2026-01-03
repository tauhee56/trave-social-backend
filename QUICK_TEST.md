# Quick API Testing Guide

## Start Server
```bash
cd trave-social-backend
npm start
```

## Test Endpoints

### 1. Story with User Data
```bash
curl -X POST http://localhost:3000/api/stories \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-123","mediaUrl":"https://example.com/img.jpg","mediaType":"image"}'
```

### 2. Section CRUD
```bash
# Create
curl -X POST http://localhost:3000/api/sections \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-123","name":"Travel"}'

# Update
curl -X PATCH http://localhost:3000/api/sections/SECTION_ID \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Travel"}'

# Delete
curl -X DELETE http://localhost:3000/api/sections/SECTION_ID
```

### 3. User Search (Excludes Self)
```bash
curl "http://localhost:3000/api/users/search?q=john&requesterUserId=test-123"
```

### 4. Follow Request
```bash
curl -X POST http://localhost:3000/api/follow/request \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"user-1","toUserId":"user-2"}'
```

### 5. Comment Reaction
```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/comments/COMMENT_ID/react \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","emoji":"😂"}'
```

### 6. Inbox with User Data
```bash
curl "http://localhost:3000/api/conversations?userId=user-1"
```

## Verify
- [ ] Stories show user avatar/name
- [ ] Sections persist after updates
- [ ] Search excludes self
- [ ] Follow requests work
- [ ] Reactions update counts
- [ ] Inbox shows user profiles

