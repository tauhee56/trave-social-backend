const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} folder - Cloudinary folder
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadToCloudinary(fileBuffer, folder, resourceType = 'auto') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ] : undefined
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('✅ Cloudinary upload success:', result.secure_url);
          resolve(result.secure_url);
        }
      }
    );
    
    uploadStream.end(fileBuffer);
  });
}

// POST /api/upload/avatar - Upload user avatar
router.post('/avatar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }
    
    const userId = req.body.userId || 'anonymous';
    const folder = `avatars/${userId}`;
    
    const url = await uploadToCloudinary(req.file.buffer, folder, 'image');
    
    console.log(`✅ Avatar uploaded for user ${userId}`);
    res.json({ success: true, url });
  } catch (err) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload/post - Upload post media
router.post('/post', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }
    
    const userId = req.body.userId || 'anonymous';
    const mediaType = req.body.mediaType || 'auto';
    const folder = `posts/${userId}`;
    
    const url = await uploadToCloudinary(req.file.buffer, folder, mediaType);
    
    console.log(`✅ Post media uploaded for user ${userId}`);
    res.json({ success: true, url, mediaType });
  } catch (err) {
    console.error('Error uploading post media:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload/story - Upload story media
router.post('/story', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }
    
    const userId = req.body.userId || 'anonymous';
    const mediaType = req.body.mediaType || 'auto';
    const folder = `stories/${userId}`;
    
    const url = await uploadToCloudinary(req.file.buffer, folder, mediaType);
    
    console.log(`✅ Story media uploaded for user ${userId}`);
    res.json({ success: true, url, mediaType });
  } catch (err) {
    console.error('Error uploading story media:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload/highlight - Upload highlight cover
router.post('/highlight', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }
    
    const userId = req.body.userId || 'anonymous';
    const folder = `highlights/${userId}`;
    
    const url = await uploadToCloudinary(req.file.buffer, folder, 'image');
    
    console.log(`✅ Highlight cover uploaded for user ${userId}`);
    res.json({ success: true, url });
  } catch (err) {
    console.error('Error uploading highlight cover:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload/multiple - Upload multiple files
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }
    
    const userId = req.body.userId || 'anonymous';
    const folder = req.body.folder || 'uploads';
    const mediaType = req.body.mediaType || 'auto';
    
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.buffer, `${folder}/${userId}`, mediaType)
    );
    
    const urls = await Promise.all(uploadPromises);
    
    console.log(`✅ Uploaded ${urls.length} files for user ${userId}`);
    res.json({ success: true, urls, count: urls.length });
  } catch (err) {
    console.error('Error uploading multiple files:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
