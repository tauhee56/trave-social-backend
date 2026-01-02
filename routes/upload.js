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

// Alias route for compatibility: POST /api/media/upload
// This route handles BOTH multipart file uploads AND JSON base64 uploads
// IMPORTANT: This route must NOT use multer middleware to allow JSON body parsing
router.post('/media/upload', async (req, res) => {
  try {
    const userId = req.body.userId || req.body.path?.split('/')[1] || 'anonymous';
    const folder = req.body.path || `media/${userId}`;
    let buffer;
    let resourceType = 'image';

    console.log('[/media/upload] 📥 Request received. Content-Type:', req.headers['content-type']);
    console.log('[/media/upload] 📥 Body keys:', Object.keys(req.body));
    console.log('[/media/upload] 📥 Has file field:', !!req.body.file);

    // Handle base64 string in body.file (React Native Expo sends this as JSON)
    if (req.body.file && typeof req.body.file === 'string') {
      console.log('[/media/upload] 🔄 Converting base64 from body.file...');
      try {
        // Remove data URL prefix if present
        const base64Data = req.body.file.includes(',') 
          ? req.body.file.split(',')[1] 
          : req.body.file;
        
        buffer = Buffer.from(base64Data, 'base64');
        resourceType = 'image';
        console.log('[/media/upload] ✅ Converted base64 to buffer, size:', buffer.length);
      } catch (conversionError) {
        console.error('[/media/upload] ❌ Base64 conversion error:', conversionError.message);
        return res.status(400).json({ success: false, error: 'Invalid base64 data' });
      }
    }
    // Handle base64 string in body.image (alternative)
    else if (req.body.image && typeof req.body.image === 'string') {
      console.log('[/media/upload] 🔄 Converting base64 from body.image...');
      const base64Data = req.body.image.includes(',') 
        ? req.body.image.split(',')[1] 
        : req.body.image;
      buffer = Buffer.from(base64Data, 'base64');
      resourceType = 'image';
      console.log('[/media/upload] ✅ Converted base64 to buffer, size:', buffer.length);
    }
    // Handle raw data buffer
    else if (req.body.data && typeof req.body.data === 'string') {
      console.log('[/media/upload] 🔄 Converting base64 from body.data...');
      buffer = Buffer.from(req.body.data, 'base64');
      resourceType = req.body.mediaType || 'image';
      console.log('[/media/upload] ✅ Converted base64 to buffer, size:', buffer.length);
    }
    else {
      console.error('[/media/upload] ❌ No file or image data provided. Body:', JSON.stringify(req.body, null, 2).substring(0, 200));
      return res.status(400).json({ success: false, error: 'No file or image data provided' });
    }

    if (!buffer || buffer.length === 0) {
      console.error('[/media/upload] ❌ Buffer is empty');
      return res.status(400).json({ success: false, error: 'Buffer is empty' });
    }

    console.log('[/media/upload] ☁️ Uploading to Cloudinary...');
    const url = await uploadToCloudinary(buffer, folder, resourceType);

    console.log(`✅ Media uploaded for user ${userId} to ${folder}: ${url}`);
    res.json({ success: true, url, data: { url } });
  } catch (err) {
    console.error('Error uploading media:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
