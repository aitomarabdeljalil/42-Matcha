const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../utils/avatar');
const { uploadAvatar, getAvatar, deleteAvatar } = require('../controllers/avatarController');

// POST /api/profile/avatar - Upload avatar
router.post('/', authenticate, upload.single('avatar'), uploadAvatar);

// GET /api/profile/avatar - Get current avatar info
router.get('/', authenticate, getAvatar);

// DELETE /api/profile/avatar - Remove avatar
router.delete('/', authenticate, deleteAvatar);

module.exports = router;
