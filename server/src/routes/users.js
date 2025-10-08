const express = require('express');
const { getNearbyUsers, getUserById } = require('../controllers/userController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/nearby', optionalAuth, getNearbyUsers);
router.get('/:id', optionalAuth, getUserById);

module.exports = router;