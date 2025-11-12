const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const autoLocation = require('../middleware/autoLocation');
const { updateProfile, managePhotos, trackView, toggleLike, setLocation } = require('../controllers/profileController');

router.patch('/', authenticate, autoLocation, updateProfile);
router.post('/photos', authenticate, autoLocation, managePhotos);
router.post('/view/:userId', authenticate, autoLocation, trackView);
router.post('/like/:userId', authenticate, autoLocation, toggleLike);
router.put('/location', authenticate, autoLocation, setLocation);

module.exports = router;
