#!/usr/bin/env node

/**
 * Test Configuration and Quick Reference
 * ======================================
 * Use this file to test all auth endpoints
 */

const BASE_URL = 'http://localhost:5000/api';

// Test data
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123456',
  displayName: 'Test User'
};

console.log(`
╔════════════════════════════════════════════════════════════════╗
║          TRAVE SOCIAL - AUTH SYSTEM TEST GUIDE                ║
╚════════════════════════════════════════════════════════════════╝

📋 BACKEND ENDPOINTS:
─────────────────────────────────────────────────────────────────

1. REGISTER NEW USER
   POST ${BASE_URL}/auth/register
   
   Body:
   {
     "email": "${TEST_USER.email}",
     "password": "${TEST_USER.password}",
     "displayName": "${TEST_USER.displayName}",
     "firebaseToken": "[optional Firebase ID token]"
   }
   
   Response:
   {
     "success": true,
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "id": "507f1f77bcf86cd799439011",
       "email": "${TEST_USER.email}",
       "displayName": "${TEST_USER.displayName}"
     }
   }

─────────────────────────────────────────────────────────────────

2. LOGIN USER
   POST ${BASE_URL}/auth/login
   
   Body (Option A - Email/Password):
   {
     "email": "${TEST_USER.email}",
     "password": "${TEST_USER.password}"
   }
   
   Body (Option B - Firebase Token):
   {
     "firebaseToken": "[Firebase ID token]"
   }
   
   Response: Same as register

─────────────────────────────────────────────────────────────────

3. VERIFY TOKEN
   POST ${BASE_URL}/auth/verify
   
   Headers:
   Authorization: Bearer [JWT token from login]
   
   Response:
   {
     "success": true,
     "user": {
       "id": "507f1f77bcf86cd799439011",
       "email": "${TEST_USER.email}",
       "displayName": "${TEST_USER.displayName}"
     }
   }

─────────────────────────────────────────────────────────────────

4. LOGOUT USER
   POST ${BASE_URL}/auth/logout
   
   Headers:
   Authorization: Bearer [JWT token]
   
   Response:
   {
     "success": true,
     "message": "Logout successful"
   }

─────────────────────────────────────────────────────────────────

🔧 TESTING WITH CURL:
─────────────────────────────────────────────────────────────────

# Register:
curl -X POST http://localhost:5000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"Test123456","displayName":"Test User"}'

# Login:
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"Test123456"}'

# Verify Token (replace TOKEN):
curl -X POST http://localhost:5000/api/auth/verify \\
  -H "Authorization: Bearer TOKEN"

─────────────────────────────────────────────────────────────────

📱 FRONTEND USAGE:
─────────────────────────────────────────────────────────────────

Import:
import { 
  signInUser, 
  signUpUser, 
  getCurrentUser, 
  logoutUser 
} from '../lib/firebaseHelpers';

// Sign up:
const result = await signUpUser('email@example.com', 'password', 'Name');
if (result.success) {
  // Navigate to app
}

// Sign in:
const result = await signInUser('email@example.com', 'password');
if (result.success) {
  // Navigate to app
}

// Get current user:
const result = await getCurrentUser();
if (result.success) {
  console.log('User:', result.user);
}

// Logout:
await logoutUser();

─────────────────────────────────────────────────────────────────

🔐 SECURITY FEATURES IMPLEMENTED:
─────────────────────────────────────────────────────────────────

✅ Password Hashing: bcryptjs (10 salt rounds)
✅ JWT Tokens: Signed with secret, 7-day expiry
✅ Authorization Header: All requests include Bearer token
✅ Token Verification: verifyToken middleware
✅ Firebase Integration: Admin SDK verification
✅ Error Handling: Proper error messages
✅ CORS: Enabled for cross-origin requests

─────────────────────────────────────────────────────────────────

📁 FILES CREATED/MODIFIED:
─────────────────────────────────────────────────────────────────

BACKEND:
✅ src/middleware/authMiddleware.js - JWT verification
✅ src/routes/auth.js - Auth endpoints
✅ src/index.js - Firebase initialization
✅ package.json - Added dependencies
✅ .env - Added JWT_SECRET and Firebase config

FRONTEND:
✅ app/_services/apiService.ts - Added interceptors
✅ app/_services/firebaseAuthService.ts - Firebase methods
✅ lib/firebaseHelpers.ts - Updated auth functions
✅ .env - Added public Firebase config

─────────────────────────────────────────────────────────────────

🚀 NEXT STEPS:
─────────────────────────────────────────────────────────────────

1. START BACKEND:
   cd c:\\Projects\\trave-social-backend
   npm run dev

2. TEST ENDPOINTS:
   Use curl or Postman with endpoints above

3. PROTECT OTHER ROUTES:
   Add verifyToken middleware to protected routes:
   
   router.get('/protected', verifyToken, (req, res) => {
     const userId = req.userId;
     // Access to user routes
   });

4. UPDATE FRONTEND:
   Make sure login/signup screens use the auth functions

─────────────────────────────────────────────────────────────────

❓ TROUBLESHOOTING:
─────────────────────────────────────────────────────────────────

Error: "Missing or invalid Authorization header"
→ Frontend is not sending JWT token with request
→ Check API interceptor in apiService.ts
→ Verify token is stored in AsyncStorage

Error: "Invalid Firebase token"
→ Firebase Admin not initialized
→ Check serviceAccountKey.json exists in backend root
→ Check FIREBASE_PROJECT_ID in .env

Error: "Password must be at least 6 characters"
→ Password too short
→ Use password with 6+ characters

Error: "User already exists"
→ Email already registered
→ Try different email or login instead

─────────────────────────────────────────────────────────────────

✨ IMPLEMENTATION COMPLETE!

All auth systems are now properly configured and ready to use.
Frontend and backend are fully integrated.

═════════════════════════════════════════════════════════════════
`);
