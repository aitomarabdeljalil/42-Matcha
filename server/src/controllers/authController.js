const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const crypto = require('crypto');
const validator = require('validator');
const { sendResetEmail, sendPasswordChangedEmail } = require('../utils/email');

const register = async (req, res) => {
  try {
    const { email, password, username, first_name, last_name, birth_date, gender, preferred_gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0], // Default username
      first_name,
      last_name,
      birth_date,
      gender,
      preferred_gender
    });

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token: accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const user = await User.findByEmail(email);
    let rawToken; let resetLink; let devFake = false;

    if (user) {
      // Token generation and storage
      rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const ttlMs = process.env.PASSWORD_RESET_TTL_MS ? parseInt(process.env.PASSWORD_RESET_TTL_MS) : (60 * 60 * 1000); // default 1h
      const expiresAt = new Date(Date.now() + ttlMs);

      await User.update(user.id, {
        reset_password_token: hashedToken,
        reset_password_expires: expiresAt
      });

      // Compose reset link. Prefer FRONTEND_URL when available (frontend will render the reset form).
      // If no FRONTEND_URL is provided, fall back to the API reset endpoint so the link works on the server.
      const frontendUrl = process.env.FRONTEND_URL && process.env.FRONTEND_URL.replace(/\/$/, '');
      const apiBase = (process.env.API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
      if (frontendUrl) {
        resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
      } else {
        // Point to API endpoint when no frontend is available
        resetLink = `${apiBase}/api/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
      }

      if (process.env.ALLOW_FAKE_RESET === 'false' && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          await sendResetEmail(email, resetLink);
        } catch (mailErr) {
          console.error('Forgot password email error:', mailErr);
        }
      } else {
        console.log('Password reset link (dev):', resetLink);
        return res.status(200).json({ message: 'If that email exists, a reset link has been sent', resetToken: rawToken, resetLink, devFake });
      } 
    }
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Keep response generic to avoid enumeration and leaking error details
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token: accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { bio, latitude, longitude, profile_picture } = req.body;
    const updates = {};

    if (bio !== undefined) updates.bio = bio;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;

    // Mark profile as complete if all required fields are present
    if (bio && latitude && longitude) {
      updates.is_profile_complete = true;
    }

    const updatedUser = await User.update(req.user.id, updates);
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  // For JWT, logout is handled client-side by deleting the token. (Thinking of blacklist tokens here).
  res.status(200).json({ message: 'Logout successful' });
};

const googleOAuthCallback = async (req, res) => {
  try {
    // Generate JWT token for the authenticated user
    const token = generateAccessToken({ userId: req.user.id });
    const refreshToken = generateRefreshToken({ userId: req.user.id });

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = req.user;

    // Send the response with user data and tokens
    res.status(200).json({
      message: 'Google OAuth login successful',
      user: userWithoutPassword,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// POST /api/auth/reset-password
// Accepts raw token and new password, validates, updates password and clears reset fields, sends confirmation email
const resetPassword = async (req, res) => {
  try {
    // Prefer token from query string for reset endpoint (e.g. POST /api/auth/reset-password?token=...)
    // Fall back to body for backward compatibility.
    const body = req.body || {};
    const tokenFromQuery = req.query && req.query.token;
    const token = tokenFromQuery || body.token;
    const { password } = body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Password strength: min 8, uppercase, lowercase, number, special char
    const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
    if (!strongPwd.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    // Validate token format and hash it
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findByValidResetToken(hashedToken);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Hash new password and update user; clear reset fields
    const hashedPassword = await hashPassword(password);
    await User.update(user.id, {
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null
    });

    // Send confirmation email if SMTP configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendPasswordChangedEmail(user.email);
      } catch (mailErr) {
        console.error('Reset password confirmation email error:', mailErr);
      }
    }

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  googleOAuthCallback,
  forgotPassword,
  resetPassword
};