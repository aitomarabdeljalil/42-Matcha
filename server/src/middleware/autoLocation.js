const User = require('../models/User');

// Middleware: attempt to update user's location automatically if older than 24h.
// Priority: GPS (req.body.latitude/longitude) -> IP fallback (no external API; set source to 'ip').
module.exports = async function autoLocation(req, res, next) {
  try {
    if (!req.user) return next();
    const user = req.user;
    const last = user.location_updated_at ? new Date(user.location_updated_at) : null;
    const now = new Date();
    const hoursSince = last ? ((now - last) / (1000 * 60 * 60)) : Infinity;
    if (hoursSince < 24) return next();

    // If client sent GPS coordinates in body, use them
    const { latitude, longitude, city, country } = req.body || {};
    if (latitude !== undefined && longitude !== undefined) {
      await User.setAutoLocation(user.id, { latitude, longitude, city, country, source: 'gps' });
      return next();
    }

    // IP fallback: we don't call external services here; record that we attempted IP fallback
    // Optionally, you can integrate an IP geolocation provider and update coords.
    await User.setAutoLocation(user.id, { latitude: null, longitude: null, city: null, country: null, source: 'ip' });
    return next();
  } catch (err) {
    // Don't block request flow on location errors
    console.warn('Auto location middleware error:', err.message || err);
    return next();
  }
};
