const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload image to Cloudinary
exports.uploadImage = async (req, res) => {
  try {
    const { image } = req.body; // base64 or URL
    if (!image) return res.status(400).json({ error: 'No image provided' });
    const result = await cloudinary.uploader.upload(image, { folder: 'trave-social' });
    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
