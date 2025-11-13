const db = require('../config/database');
const User = require('../models/User');

// Haversine distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const toRad = (v) => v * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function parseJsonField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch (e) { return [] }
}

function isSexuallyCompatible(viewer, target) {
  const viewerPrefs = parseJsonField(viewer.sexual_preferences);
  const targetPrefs = parseJsonField(target.sexual_preferences);
  const viewerPrefGender = viewer.preferred_gender;
  const targetPrefGender = target.preferred_gender;
  const tgtGender = target.gender;
  const vGender = viewer.gender;
  const viewerAccepts = (viewerPrefs.length ? viewerPrefs.includes(tgtGender) : (viewerPrefGender ? viewerPrefGender === tgtGender : true));
  const targetAccepts = (targetPrefs.length ? targetPrefs.includes(vGender) : (targetPrefGender ? targetPrefGender === vGender : true));
  return viewerAccepts && targetAccepts;
}

async function getExcludedIds(viewerId) {
  // exclude self and users viewer already liked
  const likedRows = await db('profile_likes').where({ liker_id: viewerId }).select('liked_id');
  const likedIds = likedRows.map(r => r.liked_id);
  return [viewerId, ...likedIds];
}

// Build candidate list using optional location; returns array of user objects
async function fetchCandidates(viewer, opts = {}) {
  const { maxDistance } = opts;
  const lat = viewer.latitude; const lng = viewer.longitude;
  let candidates = [];
  if (lat != null && lng != null && maxDistance) {
    candidates = await User.findNearbyUsers(lat, lng, maxDistance, 200);
  } else {
    // fallback: fetch recent active users (limit 500)
    candidates = await db('users').whereNot({ id: viewer.id }).limit(500);
  }
  return candidates;
}

function computeScores(viewer, candidates, weights = {}) {
  const { distanceWeight = 0.25, interestsWeight = 0.25, fameWeight = 0.25, recencyWeight = 0.25 } = weights;
  const vInterests = parseJsonField(viewer.interests);
  const vFame = viewer.fame_rating || 0;
  const vLat = viewer.latitude; const vLon = viewer.longitude;
  const now = Date.now();

  return candidates.map(t => {
    const tInterests = parseJsonField(t.interests);
    const common = vInterests.filter(i => tInterests.includes(i));
    const interestScore = vInterests.length ? (common.length / Math.max(vInterests.length, tInterests.length)) : 0;
    const fameDiff = Math.abs((t.fame_rating || 0) - vFame);
    const fameScore = 1 - Math.min(100, fameDiff) / 100;
    const distanceKm = (vLat != null && vLon != null && t.latitude != null && t.longitude != null) ? haversineDistance(vLat, vLon, t.latitude, t.longitude) : null;
    const distanceScore = distanceKm == null ? 0 : Math.max(0, 1 - (distanceKm / 200)); // scale: 0..200km
    const lastOnline = t.last_online ? new Date(t.last_online).getTime() : 0;
    const recencyScore = lastOnline ? Math.max(0, 1 - ((now - lastOnline) / (1000*60*60*24*30))) : 0; // 30 days scale

    const score = (distanceScore * distanceWeight) + (interestScore * interestsWeight) + (fameScore * fameWeight) + (recencyScore * recencyWeight);
    return { user: t, score, distanceKm, commonInterests: common.length };
  });
}

// GET /api/discovery/suggestions
async function suggestions(req, res) {
  try {
    const viewer = await User.findById(req.user.id);

    if (!viewer) return res.status(404).json({ error: 'Viewer not found' });
    // parse params
    const page = parseInt(req.query.page || '1', 10) || 1;
    const perPage = 20;
    const maxDistance = req.query.maxDistance ? parseFloat(req.query.maxDistance) : 50; // km default

    // Fetch candidates
    const rawCandidates = await fetchCandidates(viewer, { maxDistance });

    // Exclude liked/self
    const excludeIds = await getExcludedIds(viewer.id);
    const candidates = rawCandidates.filter(u => !excludeIds.includes(u.id));

    // Apply sexual compatibility filter (required)
    const sexuallyCompatible = candidates.filter(u => isSexuallyCompatible(viewer, u));

    // Compute scores
    const weights = {
      distanceWeight: parseFloat(req.query.w_distance) || 0.3,
      interestsWeight: parseFloat(req.query.w_interests) || 0.3,
      fameWeight: parseFloat(req.query.w_fame) || 0.2,
      recencyWeight: parseFloat(req.query.w_recency) || 0.2
    };
    let scored = computeScores(viewer, sexuallyCompatible, weights);

    // Optionally sort by compatibility (score) or other sort
    const sort = req.query.sort || 'compatibility';
    if (sort === 'distance') scored.sort((a,b) => (a.distanceKm||Infinity) - (b.distanceKm||Infinity));
    else if (sort === 'fame') scored.sort((a,b) => (b.user.fame_rating||0) - (a.user.fame_rating||0));
    else if (sort === 'commonInterests') scored.sort((a,b) => b.commonInterests - a.commonInterests);
    else if (sort === 'recent') scored.sort((a,b) => new Date(b.user.last_online) - new Date(a.user.last_online));
    else scored.sort((a,b) => b.score - a.score);

    // Pagination
    const start = (page - 1) * perPage;
    const paged = scored.slice(start, start + perPage).map(s => ({ user: s.user, score: s.score, distanceKm: s.distanceKm, commonInterests: s.commonInterests }));

    return res.json({ page, perPage, results: paged, total: scored.length });
  } catch (err) {
    console.error('Discovery suggestions error:', err);
    return res.status(500).json({ error: 'Failed to compute suggestions' });
  }
}

// GET /api/discovery/search
async function search(req, res) {
  try {
    const viewer = await User.findById(req.user.id);
    if (!viewer) return res.status(404).json({ error: 'Viewer not found' });
    const page = parseInt(req.query.page || '1', 10) || 1;
    const perPage = parseInt(req.query.limit || '20', 10) || 20;

    // Filters
    const minAge = req.query.minAge ? parseInt(req.query.minAge,10) : null;
    const maxAge = req.query.maxAge ? parseInt(req.query.maxAge,10) : null;
    const maxDistance = req.query.maxDistance ? parseFloat(req.query.maxDistance) : null;
    const minFame = req.query.minFame ? parseFloat(req.query.minFame) : null;
    const maxFame = req.query.maxFame ? parseFloat(req.query.maxFame) : null;
    const genders = req.query.gender ? (Array.isArray(req.query.gender) ? req.query.gender : [req.query.gender]) : null;
    const interests = req.query.interests ? (Array.isArray(req.query.interests) ? req.query.interests : req.query.interests.split(',')) : null;

    // Base candidates
    let rawCandidates = [];
    if (viewer.latitude != null && viewer.longitude != null && maxDistance) {
      rawCandidates = await User.findNearbyUsers(viewer.latitude, viewer.longitude, maxDistance, 1000);
    } else {
      rawCandidates = await db('users').whereNot({ id: viewer.id }).limit(1000);
    }

    // Exclude liked/self
    const excludeIds = await getExcludedIds(viewer.id);
    let candidates = rawCandidates.filter(u => !excludeIds.includes(u.id));

    // Apply filters
    const now = Date.now();
    if (minAge || maxAge) {
      candidates = candidates.filter(u => {
        if (!u.birth_date) return false;
        const age = Math.floor((now - new Date(u.birth_date)) / (1000*60*60*24*365.25));
        if (minAge && age < minAge) return false;
        if (maxAge && age > maxAge) return false;
        return true;
      });
    }
    if (minFame !== null) candidates = candidates.filter(u => (u.fame_rating||0) >= minFame);
    if (maxFame !== null) candidates = candidates.filter(u => (u.fame_rating||0) <= maxFame);
    if (genders) candidates = candidates.filter(u => genders.includes(u.gender));
    if (interests) candidates = candidates.filter(u => {
      const tInterests = parseJsonField(u.interests);
      return interests.some(i => tInterests.includes(i));
    });

    // scoring and sorting
    const scored = computeScores(viewer, candidates, {
      distanceWeight: 0.25, interestsWeight: 0.35, fameWeight: 0.2, recencyWeight: 0.2
    });

    const sort = req.query.sort || 'compatibility';
    if (sort === 'distance') scored.sort((a,b) => (a.distanceKm||Infinity) - (b.distanceKm||Infinity));
    else if (sort === 'fame') scored.sort((a,b) => (b.user.fame_rating||0) - (a.user.fame_rating||0));
    else if (sort === 'commonInterests') scored.sort((a,b) => b.commonInterests - a.commonInterests);
    else if (sort === 'recent') scored.sort((a,b) => new Date(b.user.last_online) - new Date(a.user.last_online));
    else scored.sort((a,b) => b.score - a.score);

    const start = (page - 1) * perPage;
    const paged = scored.slice(start, start + perPage).map(s => ({ user: s.user, score: s.score, distanceKm: s.distanceKm, commonInterests: s.commonInterests }));
    return res.json({ page, perPage, results: paged, total: scored.length });
  } catch (err) {
    console.error('Discovery search error:', err);
    return res.status(500).json({ error: 'Failed to execute search' });
  }
}

module.exports = { suggestions, search };
