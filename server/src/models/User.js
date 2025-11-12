const db = require('../config/database');

class User {
  static async create(userData) {
    const [user] = await db('users')
      .insert(userData)
      .returning('*');
    return user;
  }

  // Photos stored as JSON array in `photos` column. Helpers below manage photos with max 5.
  static async addPhoto(id, photoUrl) {
    return db.transaction(async trx => {
      const user = await trx('users').where({ id }).first();
      const photos = user.photos ? JSON.parse(user.photos) : [];
      if (photos.length >= 5) throw new Error('MAX_PHOTOS_REACHED');
      photos.push(photoUrl);
      const [updated] = await trx('users').where({ id }).update({ photos: JSON.stringify(photos) }).returning('*');
      return updated;
    });
  }

  static async removePhoto(id, index) {
    return db.transaction(async trx => {
      const user = await trx('users').where({ id }).first();
      const photos = user.photos ? JSON.parse(user.photos) : [];
      if (index < 0 || index >= photos.length) throw new Error('INVALID_PHOTO_INDEX');
      photos.splice(index, 1);
      const [updated] = await trx('users').where({ id }).update({ photos: JSON.stringify(photos) }).returning('*');
      return updated;
    });
  }

  static async reorderPhotos(id, newOrderArray) {
    return db('users').where({ id }).update({ photos: JSON.stringify(newOrderArray) }).returning('*').then(rows => rows[0]);
  }

  static async incrementView(viewerId, viewedId) {
    if (viewerId === viewedId) return null;
    return db.transaction(async trx => {
      await trx('profile_views').insert({ viewer_id: viewerId, viewed_id: viewedId });
      const [{ count }] = await trx('profile_views').where({ viewed_id: viewedId }).count('id as count');
      const viewsCount = parseInt(count, 10) || 0;
      const [updated] = await trx('users').where({ id: viewedId }).update({ profile_views: viewsCount }).returning('*');
      return updated;
    });
  }

  static async toggleLike(likerId, likedId) {
    if (likerId === likedId) return null;
    return db.transaction(async trx => {
      const existing = await trx('profile_likes').where({ liker_id: likerId, liked_id: likedId }).first();
      if (existing) {
        await trx('profile_likes').where({ id: existing.id }).del();
      } else {
        await trx('profile_likes').insert({ liker_id: likerId, liked_id: likedId });
      }
      const [{ count }] = await trx('profile_likes').where({ liked_id: likedId }).count('id as count');
      const likesCount = parseInt(count, 10) || 0;
      const [updated] = await trx('users').where({ id: likedId }).update({ likes_count: likesCount }).returning('*');
      return { user: updated, liked: !existing };
    });
  }

  static async setManualLocation(id, { latitude, longitude, city, country }) {
    const updates = {
      latitude: latitude || null,
      longitude: longitude || null,
      city: city || null,
      country: country || null,
      location_source: 'manual'
    };
    const [user] = await db('users').where({ id }).update(updates).returning('*');
    return user;
  }

  static async setAutoLocation(id, { latitude, longitude, city, country, source = 'ip' }) {
    const updates = {
      latitude: latitude || null,
      longitude: longitude || null,
      city: city || null,
      country: country || null,
      location_source: source,
      location_updated_at: new Date()
    };
    const [user] = await db('users').where({ id }).update(updates).returning('*');
    return user;
  }

  // Recalculate profile completion percentage based on rules
  static async recalcProfileCompletion(id) {
    const user = await db('users').where({ id }).first();
    const genderScore = user.gender ? 15 : 0;
    const prefScore = user.preferred_gender || user.sexual_preferences ? 15 : 0;
    const bioScore = user.biography ? 20 : 0;
    const interests = user.interests ? JSON.parse(user.interests) : [];
    const interestsScore = (interests && interests.length > 0) ? 15 : 0;
    const photos = user.photos ? JSON.parse(user.photos) : [];
    const photosScore = (photos && photos.length > 0) ? Math.min(35, Math.round((photos.length / 5) * 35)) : 0;
    const completion = genderScore + prefScore + bioScore + interestsScore + photosScore;
    const [updated] = await db('users').where({ id }).update({ profile_completion: completion }).returning('*');
    return updated;
  }

  // Recalculate fame rating: views(30%) + likes(40%) + completion(20%) + accountAge(10%)
  static async recalcFameRating(id) {
    const user = await db('users').where({ id }).first();
    const views = user.profile_views || 0;
    const likes = user.likes_count || 0;
    const completion = user.profile_completion || 0;
    const createdAt = user.created_at || user.createdAt || new Date();
    const ageDays = Math.max(0, Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24)));
    // Normalize metrics to reasonable scales: assume views and likes saturate at 1000 for scoring
    const viewsScore = Math.min(100, Math.round((views / 1000) * 100));
    const likesScore = Math.min(100, Math.round((likes / 1000) * 100));
    const ageScore = Math.min(100, Math.round(Math.min(ageDays, 365) / 365 * 100));

    const fame = Math.round(
      (viewsScore * 0.30) +
      (likesScore * 0.40) +
      (completion * 0.20) +
      (ageScore * 0.10)
    );
    const fameRating = Math.max(0, Math.min(100, fame));
    const [updated] = await db('users').where({ id }).update({ fame_rating: fameRating }).returning('*');
    return updated;
  }

  static async findByEmail(email) {
    return db('users').where({ email }).first();
  }

  static async findById(id) {
    return db('users').where({ id }).first();
  }

  static async update(id, updates) {
    const [user] = await db('users')
      .where({ id })
      .update(updates)
      .returning('*');
    return user;
  }

  static async updateLastOnline(id) {
    await db('users')
      .where({ id })
      .update({ last_online: new Date() });
  }

  static async findNearbyUsers(lat, lng, radius = 50, limit = 20) {
    // Simple radius search (for demo - in production use PostGIS)
    return db('users')
      .whereRaw(`
        (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
        sin(radians(latitude)))) < ?
      `, [lat, lng, lat, radius])
      .limit(limit);
  }
  
  static async findByGoogleId(googleId) {
    return db('users').where({ googleId }).first();
  }

  static async createOAuth({ googleId, facebookId, email, username, first_name, last_name }) {
    return db('users').insert({
      googleId,
      email,
      username,
      first_name,
      last_name
    }).returning('*').then(rows => rows[0]);
  }

  static async deleteByEmail(email) {
    return db('users').where({ email }).del();
  }

  static async findByValidResetToken(tokenHash, now = new Date()) {
    return db('users')
      .where({ reset_password_token: tokenHash })
      .andWhere('reset_password_expires', '>', now)
      .first();
  }
}

module.exports = User;