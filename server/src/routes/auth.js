const express = require('express');
const { register, login, logout, getProfile, updateProfile } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const refreshRouter = require('./refresh');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/logout', authenticate, logout);
router.use('/refresh', refreshRouter);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/protected', authenticate, (req, res) => {
	res.status(200).json({ message: 'Protected route accessed' });
});

module.exports = router;