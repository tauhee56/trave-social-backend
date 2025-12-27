const express = require('express');
const router = express.Router();


const userController = require('../controllers/userController');

// Search users (GET /api/users/search?q=query)
router.get('/search', userController.searchUsers);

// Create or update user (POST /api/users)
router.post('/', userController.createOrUpdateUser);

// User nested routes (MUST be before /:uid to avoid conflicts)

// Section management routes (MUST be before other :uid routes)
// Create section (POST /api/users/:uid/sections)
router.post('/:uid/sections', userController.createSection);

// Update section (PUT /api/users/:uid/sections/:sectionName)
router.put('/:uid/sections/:sectionName', userController.updateSection);

// Delete section (DELETE /api/users/:uid/sections/:sectionName)
router.delete('/:uid/sections/:sectionName', userController.deleteSection);

// Get user posts (GET /api/users/:uid/posts)
router.get('/:uid/posts', userController.getUserPosts);

// Get user highlights (GET /api/users/:uid/highlights)
router.get('/:uid/highlights', userController.getUserHighlights);

// Get user sections (GET /api/users/:uid/sections)
router.get('/:uid/sections', userController.getUserSections);

// Get user stories (GET /api/users/:uid/stories)
router.get('/:uid/stories', userController.getUserStories);

// Update user profile (PUT /api/users/:uid)
router.put('/:uid', userController.updateUserProfile);

// Get user profile (GET /api/users/:uid)
router.get('/:uid', userController.getUserProfile);

// List all users (GET /api/users)
router.get('/', userController.listUsers);

module.exports = router;
