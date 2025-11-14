const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const autoLocation = require('../middleware/autoLocation');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { updateProfile, managePhotos, trackView, toggleLike, setLocation } = require('../controllers/profileController');

// Multer storage config: store in server/uploads with unique filenames
const uploadDir = path.join(__dirname, '../../uploads');
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase();
		const name = Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext;
		cb(null, name);
	}
});

const fileFilter = (req, file, cb) => {
	const allowed = /jpeg|jpg|png|gif/;
	const ext = path.extname(file.originalname).toLowerCase();
	if (allowed.test(file.mimetype) && allowed.test(ext)) return cb(null, true);
	return cb(new Error('INVALID_FILE_TYPE'));
};

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

router.patch('/', authenticate, autoLocation, updateProfile);
// Accept multipart uploads (field name: "photos") up to 5 files. validate types & size via multer.
router.post('/photos', authenticate, autoLocation, upload.array('photos', 5), managePhotos);
router.post('/view/:userId', authenticate, autoLocation, trackView);
router.post('/like/:userId', authenticate, autoLocation, toggleLike);
router.put('/location', authenticate, autoLocation, setLocation);

module.exports = router;
