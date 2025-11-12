const User = require('../models/User');
const http = require('http');

// Simple IP geolocation using ip-api.com (free, rate-limited). This is a best-effort fallback.
function geolocateIp(ip) {
  return new Promise((resolve, reject) => {
    try {
      const cleanIp = ip && typeof ip === 'string' ? ip.split(',')[0].trim() : '';
      const path = `/json/${cleanIp || ''}?fields=status,message,country,city,lat,lon`;
      const opts = { hostname: 'ip-api.com', path, method: 'GET' };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data || '{}');
            if (json.status !== 'success') return resolve({ success: false, json });
            return resolve({ success: true, latitude: json.lat, longitude: json.lon, city: json.city || null, country: json.country || null, json });
          } catch (e) {
            return resolve({ success: false, error: 'parse_error' });
          }
        });
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch (e) {
      return resolve({ success: false, error: 'exception' });
    }
  });
}

// Middleware: attempt to update user's location automatically if older than 24h.
// Priority: GPS (req.body.latitude/longitude) -> IP fallback (calls ip-api.com to get coords).
module.exports = async function autoLocation(req, res, next) {
  try {
    if (!req.user) return next();
    const user = req.user;
    const last = user.location_updated_at ? new Date(user.location_updated_at) : null;
    const now = new Date();
    const hoursSince = last ? ((now - last) / (1000 * 60 * 60)) : Infinity;
    // Allow forcing an immediate update via query or header for testing: ?force_location_update=true
    const force = (req.query && req.query.force_location_update === 'true') || (req.headers && req.headers['x-force-location'] === '1');
    if (!force && hoursSince < 24) return next();

    // If client sent GPS coordinates in body, use them (mark as gps)
    const { latitude, longitude, city, country } = req.body || {};
    if (latitude !== undefined && longitude !== undefined) {
      await User.setAutoLocation(user.id, { latitude, longitude, city, country, source: 'gps' });
      return next();
    }

    // IP fallback: attempt to geolocate the request IP and populate coords
    // Allow test override ip via query or header
    const testIp = (req.query && req.query.ip) || req.headers['x-test-ip'];
    const ip = testIp || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
    const geo = await geolocateIp(ip);
    // store attempt details for debugging
    req._lastGeo = { attemptedIp: ip, result: geo };
    if (geo && geo.success) {
      await User.setAutoLocation(user.id, { latitude: geo.latitude, longitude: geo.longitude, city: geo.city, country: geo.country, source: 'ip' });
    } else {
      // If geolocation failed, still update timestamp to avoid repeated attempts in short time
      console.warn('IP geolocation failed for', ip, geo);
      await User.setAutoLocation(user.id, { latitude: null, longitude: null, city: null, country: null, source: 'ip' });
    }

    return next();
  } catch (err) {
    // Don't block request flow on location errors
    console.warn('Auto location middleware error:', err.message || err);
    return next();
  }
};
