const db = require('../config/database');

class User {
  static async create(userData) {
    const [user] = await db('users')
      .insert(userData)
      .returning('*');
    return user;
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
  
  static async deleteByEmail(email) {
    return db('users').where({ email }).del();
  }
}

module.exports = User;