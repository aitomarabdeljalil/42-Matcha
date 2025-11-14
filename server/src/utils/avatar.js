const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const fs = require('fs').promises;

// Avatar upload directory
const avatarDir = path.join(__dirname, '../../uploads/avatars');

// Multer storage config for avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    // Unique filename: userId-timestamp-uuid.webp (actual webp extension added after processing)
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();
    const uuid = crypto.randomBytes(8).toString('hex');
    const filename = `${userId}-${timestamp}-${uuid}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only image MIME types
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  
  if (allowedMimes.includes(mime) && allowedExts.includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('INVALID_FILE_TYPE'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter
});

/**
 * Process uploaded avatar image with Sharp
 * - Resize to 500x500
 * - Convert to WebP
 * - Optimize quality
 * Returns filename (without extension, will add .webp)
 */
async function processAvatarImage(inputPath, filename) {
  try {
    // Output filename with .webp extension
    const outputFilename = `${filename}.webp`;
    const outputPath = path.join(avatarDir, outputFilename);

    // Process with Sharp: resize, convert to WebP, optimize
    await sharp(inputPath)
      .resize(500, 500, {
        fit: 'cover',
        position: 'center',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .webp({ quality: 80, effort: 6 })
      .toFile(outputPath);

    // Delete temporary input file
    await fs.unlink(inputPath).catch(() => {});

    return outputFilename;
  } catch (error) {
    // Cleanup on error
    await fs.unlink(inputPath).catch(() => {});
    throw new Error(`IMAGE_PROCESSING_FAILED: ${error.message}`);
  }
}

/**
 * Delete avatar file from disk
 */
async function deleteAvatarFile(filename) {
  if (!filename) return;
  try {
    const filePath = path.join(avatarDir, filename);
    await fs.unlink(filePath);
  } catch (error) {
    console.warn(`Failed to delete avatar file ${filename}:`, error.message);
    // Don't throw; file may already be gone
  }
}

/**
 * Ensure avatar directory exists
 */
async function ensureAvatarDir() {
  try {
    await fs.mkdir(avatarDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create avatar directory:', error);
  }
}

module.exports = {
  upload,
  processAvatarImage,
  deleteAvatarFile,
  ensureAvatarDir,
  avatarDir
};
