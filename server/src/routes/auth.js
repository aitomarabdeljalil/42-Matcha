const express = require('express');
const { register, login, logout, getProfile, updateProfile, googleOAuthCallback } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const refreshRouter = require('./refresh');
const passport = require('../config/passport');

const router = express.Router();

// JWT Auth routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/logout', authenticate, logout);
router.use('/refresh', refreshRouter);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/protected', authenticate, (req, res) => {
	res.status(200).json({ message: 'Protected route accessed' });
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }), (req, res) => {
	googleOAuthCallback(req, res);
});

module.exports = router;