const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, logout, getProfile, updateProfile, googleOAuthCallback, forgotPassword, resetPassword } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const refreshRouter = require('./refresh');
const passport = require('../config/passport');

const router = express.Router();

// Rate limiter specifically for password reset endpoints
const passwordResetLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 3, // limit each IP to 3 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		return res.status(429).json({ error: 'Too many password reset attempts from this IP, please try again after 15 minutes.' });
	}
});

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

// Password reset routes (backend-only)
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
// router.post('/forgot-password', passwordResetLimiter, forgotPassword);

module.exports = router;