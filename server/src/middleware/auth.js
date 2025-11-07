const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

// Helper: accept token from Bearer header, query param, or body
const extractToken = (req) => {
  return (
    req.header('Authorization')?.replace('Bearer ', '') ||
    req.query?.token ||
    req.body?.token ||
    null
  );
};

const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = verifyAccessToken(token);
    // payload may contain { userId: id } — tolerate a few shapes
    const userId = decoded?.userId || decoded?.id || (decoded?.user && decoded.user.id);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Update last online timestamp (fire-and-forget)
    User.updateLastOnline(user.id).catch(() => {});

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifyAccessToken(token);
      const userId = decoded?.userId || decoded?.id || (decoded?.user && decoded.user.id);
      const user = await User.findById(userId);
      if (user) {
        User.updateLastOnline(user.id).catch(() => {});
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // ignore errors in optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};