const express = require('express');
const router = express.Router();
const { suggestions, search } = require('../controllers/discoveryController');
const { authenticate } = require('../middleware/auth');

router.get('/suggestions', authenticate, suggestions);
router.get('/search', authenticate, search);

module.exports = router;
