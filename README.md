# Trave Social Backend

This backend replaces Firestore and Firebase Storage with Node.js/Express, MongoDB, and Cloudinary. Firebase Authentication is still used for auth.

## Features
- REST API for users, posts, notifications, media
- MongoDB for data storage
- Cloudinary for media uploads
- CORS enabled for mobile clients

## Setup
1. Copy `.env.example` to `.env` and fill in your values:
	- `PORT`: Backend port (default 5000)
	- `MONGO_URI`: MongoDB connection string
	- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary creds
2. Run `npm install`
3. Start server: `npm run dev` (for development)
4. CORS: By default allows Expo (`http://localhost:19006`), web (`http://localhost:3000`), and fallback `*`.

## API Structure
- `/api/users` - User management
- `/api/posts` - Post management
- `/api/notifications` - Notifications
- `/api/media` - Media upload (Cloudinary)

## Next Steps
- Implement route logic in `src/routes/`
- Update frontend to use new REST APIs
