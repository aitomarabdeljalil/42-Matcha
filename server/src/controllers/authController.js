const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');

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

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile
};