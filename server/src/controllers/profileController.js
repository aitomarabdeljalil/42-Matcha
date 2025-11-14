const User = require('../models/User');
const autoLocation = require('../middleware/autoLocation');
const fs = require('fs').promises;
const path = require('path');

function normalizeUser(user) {
  if (!user) return user;
  const u = { ...user };
  try { u.photos = user.photos ? JSON.parse(user.photos) : []; } catch (e) { u.photos = user.photos || []; }
  try { u.interests = user.interests ? JSON.parse(user.interests) : []; } catch (e) { u.interests = user.interests || []; }
  try { u.sexual_preferences = user.sexual_preferences ? JSON.parse(user.sexual_preferences) : []; } catch (e) { u.sexual_preferences = user.sexual_preferences || []; }
  // Remove sensitive fields before returning the user object
  try { delete u.password; } catch (e) { /* ignore */ }
  return u;
}

// PATCH /api/profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gender, sexualPreferences, biography, interests } = req.body || {};
    const updates = {};
    if (gender !== undefined) updates.gender = gender;
    if (sexualPreferences !== undefined) updates.sexual_preferences = JSON.stringify(sexualPreferences);
    if (biography !== undefined) updates.biography = biography;
    if (interests !== undefined) updates.interests = JSON.stringify(interests);

  const updated = await User.update(userId, updates);
  await User.recalcProfileCompletion(userId);
  await User.recalcFameRating(userId);
  const fresh = await User.findById(userId);
  return res.status(200).json({ user: normalizeUser(fresh) });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

// POST /api/profile/photos
const managePhotos = async (req, res) => {
  try {
    const userId = req.user.id;
    // If multipart files uploaded via multer, handle file saves and DB update
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files; // each has { filename }
      // Load current user's photos
      const user = await User.findById(userId);
      const current = user.photos ? (() => { try { return JSON.parse(user.photos); } catch (e) { return []; } })() : [];
      // If user already has max photos, remove uploaded files and reject
      if (current.length >= 5) {
        // cleanup uploaded files
        await Promise.all(files.map(f => fs.unlink(path.join(__dirname, '../../uploads', f.filename)).catch(() => {})));
        return res.status(400).json({ error: 'Max 5 photos allowed' });
      }
      // Append allowed number of files up to 5
      const remaining = 5 - current.length;
      const accepted = files.slice(0, remaining);
      const extra = files.slice(remaining);
      // Remove extra from disk
      await Promise.all(extra.map(f => fs.unlink(path.join(__dirname, '../../uploads', f.filename)).catch(() => {})));
      const urls = accepted.map(f => `/uploads/${f.filename}`);
      const combined = current.concat(urls).slice(0, 5);
      const updated = await User.reorderPhotos(userId, combined);
      await User.recalcProfileCompletion(userId);
      await User.recalcFameRating(userId);
      return res.status(200).json({ user: normalizeUser(updated) });
    }

    // Otherwise, support legacy JSON-based actions (add/remove/reorder)
    const { action } = req.body || {};
    if (!action) return res.status(400).json({ error: 'Action is required' });

    if (action === 'add') {
      const { photo } = req.body;
      if (!photo) return res.status(400).json({ error: 'Photo URL is required' });
      const updated = await User.addPhoto(userId, photo);
      await User.recalcProfileCompletion(userId);
      await User.recalcFameRating(userId);
      return res.status(200).json({ user: normalizeUser(updated) });
    }

    if (action === 'remove') {
      const { index } = req.body;
      if (index === undefined) return res.status(400).json({ error: 'Index is required' });
      const updated = await User.removePhoto(userId, index);
      await User.recalcProfileCompletion(userId);
      await User.recalcFameRating(userId);
      return res.status(200).json({ user: normalizeUser(updated) });
    }

    if (action === 'reorder') {
      const { order } = req.body; // expected array of photo URLs
      if (!Array.isArray(order)) return res.status(400).json({ error: 'Order array required' });
      if (order.length > 5) return res.status(400).json({ error: 'Max 5 photos allowed' });
      const updated = await User.reorderPhotos(userId, order);
      await User.recalcProfileCompletion(userId);
      await User.recalcFameRating(userId);
      return res.status(200).json({ user: normalizeUser(updated) });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Manage photos error:', error);
    if (error.message === 'MAX_PHOTOS_REACHED') return res.status(400).json({ error: 'Max 5 photos allowed' });
    // Multer invalid file type error handling
    if (error.message === 'INVALID_FILE_TYPE') return res.status(400).json({ error: 'Invalid file type. Allowed: jpg, png, gif' });
    return res.status(500).json({ error: 'Failed to manage photos' });
  }
};

// POST /api/profile/view/:userId
const trackView = async (req, res) => {
  try {
    const viewerId = req.user.id;
    const viewedId = parseInt(req.params.userId, 10);
    if (!viewedId) return res.status(400).json({ error: 'Invalid userId' });
    if (viewerId === viewedId) return res.status(400).json({ error: 'Cannot view your own profile' });
  const updated = await User.incrementView(viewerId, viewedId);
  if (updated) await User.recalcFameRating(viewedId);
  return res.status(200).json({ user: normalizeUser(updated) });
  } catch (error) {
    console.error('Track view error:', error);
    return res.status(500).json({ error: 'Failed to track view' });
  }
};

// POST /api/profile/like/:userId
const toggleLike = async (req, res) => {
  try {
    const likerId = req.user.id;
    const likedId = parseInt(req.params.userId, 10);
    if (!likedId) return res.status(400).json({ error: 'Invalid userId' });
    if (likerId === likedId) return res.status(400).json({ error: 'Cannot like your own profile' });
  const { user, liked } = await User.toggleLike(likerId, likedId);
  if (user) await User.recalcFameRating(likedId);
  return res.status(200).json({ user: normalizeUser(user), liked });
  } catch (error) {
    console.error('Toggle like error:', error);
    if (error.code === 'SQLITE_CONSTRAINT' || /unique/i.test(error.message)) {
      // unique constraint - already liked
    }
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
};

// PUT /api/profile/location
/* 
curl -i -X PUT "http://localhost:8000/api/profile/location?force_location_update=true&ip=8.8.8.8&debug_geo=true" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
*/
const setLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, city, country } = req.body || {};
    // If latitude/longitude provided in body treat as manual update.
    if (latitude !== undefined && longitude !== undefined) {
      const updated = await User.setManualLocation(userId, { latitude, longitude, city, country });
      await User.recalcFameRating(userId);
      return res.status(200).json({ user: normalizeUser(updated) });
    }

  // No coords in body: run autoLocation middleware now (it respects the 24h throttle unless forced).
  await new Promise((resolve) => autoLocation(req, null, resolve));
  // Return the fresh user record (so callers can see the auto-populated coords).
  const fresh = await User.findById(userId);
    // If still no coords available, indicate that we couldn't determine location yet.
    const debugGeo = req.query && req.query.debug_geo === 'true';
    if (fresh && (fresh.latitude === null || fresh.latitude === undefined) && (fresh.longitude === null || fresh.longitude === undefined)) {
      const resp = { message: 'Location not available yet', user: normalizeUser(fresh) };
      if (debugGeo && req._lastGeo) resp.geoDebug = req._lastGeo;
      return res.status(200).json(resp);
    }
    const resp = { user: normalizeUser(fresh) };
    if (debugGeo && req._lastGeo) resp.geoDebug = req._lastGeo;
    return res.status(200).json(resp);
  } catch (error) {
    console.error('Set location error:', error);
    return res.status(500).json({ error: 'Failed to set location' });
  }
};

module.exports = {
  updateProfile,
  managePhotos,
  trackView,
  toggleLike,
  setLocation
};
