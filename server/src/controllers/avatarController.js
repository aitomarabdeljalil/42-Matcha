const User = require('../models/User');
const { processAvatarImage, deleteAvatarFile, ensureAvatarDir } = require('../utils/avatar');
const path = require('path');

// Initialize avatar directory
ensureAvatarDir().catch(err => console.error('Avatar dir init failed:', err));

/**
 * POST /api/profile/avatar
 * Upload and process a new avatar image
 * Accepts: multipart/form-data with field name 'avatar'
 * Returns: { success: true, avatar_url: "/avatars/filename.webp" }
 */
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    // Multer validation
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // req.file has filename (without extension), need to process it
    const tempFilename = req.file.filename;
    const tempPath = req.file.path;

    // Process avatar image (resize, convert to WebP, optimize)
    let processedFilename;
    try {
      processedFilename = await processAvatarImage(tempPath, tempFilename);
    } catch (processErr) {
      console.error('Avatar processing error:', processErr);
      return res.status(500).json({ error: 'Failed to process image' });
    }

    // Get old avatar to delete
    const oldAvatarUrl = await User.getAvatarUrl(userId);
    const oldFilename = oldAvatarUrl ? path.basename(oldAvatarUrl) : null;

    // Update user record with new avatar
    const updatedUser = await User.updateAvatarUrl(userId, processedFilename);

    // Delete old avatar file asynchronously (don't block response)
    if (oldFilename) {
      deleteAvatarFile(oldFilename).catch(err => console.error('Failed to cleanup old avatar:', err));
    }

    // Return avatar URL relative to server root
    return res.status(200).json({
      success: true,
      avatar_url: `/avatars/${processedFilename}`,
      user: { id: updatedUser.id, avatar_url: processedFilename }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

/**
 * GET /api/profile/avatar
 * Get current avatar info
 */
const getAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.avatar_url) {
      return res.status(200).json({
        avatar_url: null,
        avatar_updated_at: null
      });
    }

    return res.status(200).json({
      avatar_url: `/avatars/${user.avatar_url}`,
      avatar_updated_at: user.avatar_updated_at,
      user: {
        id: user.id,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Get avatar error:', error);
    return res.status(500).json({ error: 'Failed to retrieve avatar' });
  }
};

/**
 * DELETE /api/profile/avatar
 * Remove avatar and set to null (default)
 */
const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get old avatar filename
    const oldAvatarUrl = await User.getAvatarUrl(userId);
    const oldFilename = oldAvatarUrl ? path.basename(oldAvatarUrl) : null;

    // Update user record to clear avatar
    const updatedUser = await User.deleteAvatar(userId);

    // Delete avatar file asynchronously
    if (oldFilename) {
      deleteAvatarFile(oldFilename).catch(err => console.error('Failed to delete avatar file:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
      user: { id: updatedUser.id, avatar_url: null }
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return res.status(500).json({ error: 'Failed to delete avatar' });
  }
};

module.exports = {
  uploadAvatar,
  getAvatar,
  deleteAvatar
};
