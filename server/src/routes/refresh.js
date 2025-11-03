const express = require('express');
const router = express.Router();
const jwt = require('../utils/jwt');
const User = require('../models/User');

// POST /auth/refresh
router.post('/', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }
  try {
    const payload = jwt.verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const user = await User.query().findById(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const accessToken = jwt.generateAccessToken(user);
    return res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

module.exports = router;
