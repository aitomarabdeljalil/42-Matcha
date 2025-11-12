const request = require('supertest');
const app = require('../src/app');
const knex = require('knex')(require('../knexfile').test);
const User = require('../src/models/User');

let tokenA, tokenB, userA, userB;

const userDataA = {
  email: `profile_a_${Date.now()}@example.com`,
  password: 'TestPass123!',
  username: `profile_a_${Date.now()}`,
  first_name: 'Alice',
  last_name: 'Anderson',
  birth_date: '1992-01-01',
  gender: 'female',
  preferred_gender: 'male'
};

const userDataB = {
  email: `profile_b_${Date.now()}@example.com`,
  password: 'TestPass123!',
  username: `profile_b_${Date.now()}`,
  first_name: 'Bob',
  last_name: 'Barker',
  birth_date: '1990-01-01',
  gender: 'male',
  preferred_gender: 'female'
};

beforeAll(async () => {
  await knex.migrate.latest();
  await knex.seed.run();
  // Clean up if prior exists
  await User.deleteByEmail(userDataA.email);
  await User.deleteByEmail(userDataB.email);
  // Register users
  const resA = await request(app).post('/api/auth/register').send(userDataA);
  expect(resA.statusCode).toBe(201);
  userA = resA.body.user;

  const resB = await request(app).post('/api/auth/register').send(userDataB);
  expect(resB.statusCode).toBe(201);
  userB = resB.body.user;

  const loginA = await request(app).post('/api/auth/login').send({ email: userDataA.email, password: userDataA.password });
  expect(loginA.statusCode).toBe(200);
  tokenA = loginA.body.token;

  const loginB = await request(app).post('/api/auth/login').send({ email: userDataB.email, password: userDataB.password });
  expect(loginB.statusCode).toBe(200);
  tokenB = loginB.body.token;
});

afterAll(async () => {
  await User.deleteByEmail(userDataA.email);
  await User.deleteByEmail(userDataB.email);
  await knex.destroy();
});

describe('Profile endpoints', () => {
  test('Update profile and recalc completion/fame', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ biography: 'Hello world', sexualPreferences: ['women'], interests: ['hiking','music'] });
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.biography).toBe('Hello world');
    expect(typeof res.body.user.profile_completion).toBe('number');
    expect(typeof res.body.user.fame_rating).toBe('number');
  });

  test('Add, remove and reorder photos (max 5)', async () => {
    // Add photo
    const p1 = await request(app).post('/api/profile/photos').set('Authorization', `Bearer ${tokenA}`).send({ action: 'add', photo: 'https://example.com/p1.jpg' });
    expect(p1.statusCode).toBe(200);
    expect(Array.isArray(p1.body.user.photos)).toBe(true);

    // Add second photo
    const p2 = await request(app).post('/api/profile/photos').set('Authorization', `Bearer ${tokenA}`).send({ action: 'add', photo: 'https://example.com/p2.jpg' });
    expect(p2.statusCode).toBe(200);
    expect(p2.body.user.photos.length).toBeGreaterThanOrEqual(2);

    // Reorder
    const current = p2.body.user.photos;
    const newOrder = [current[1], current[0]];
    const r = await request(app).post('/api/profile/photos').set('Authorization', `Bearer ${tokenA}`).send({ action: 'reorder', order: newOrder });
    expect(r.statusCode).toBe(200);
    expect(r.body.user.photos[0]).toBe(newOrder[0]);

    // Remove first photo
    const rem = await request(app).post('/api/profile/photos').set('Authorization', `Bearer ${tokenA}`).send({ action: 'remove', index: 0 });
    expect(rem.statusCode).toBe(200);
    expect(Array.isArray(rem.body.user.photos)).toBe(true);
  });

  test('Track view and like on another user', async () => {
    // Initial counts
    const before = await User.findById(userB.id);
    const beforeViews = before.profile_views || 0;
    const beforeLikes = before.likes_count || 0;

    // View
    const v = await request(app).post(`/api/profile/view/${userB.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(v.statusCode).toBe(200);
    expect(v.body.user).toBeDefined();
    expect(v.body.user.profile_views).toBeGreaterThanOrEqual(beforeViews + 1);

    // Like
    const l = await request(app).post(`/api/profile/like/${userB.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(l.statusCode).toBe(200);
    expect(l.body.user).toBeDefined();
    expect(typeof l.body.liked).toBe('boolean');
    const likedOnce = l.body.liked === true;

    // Toggle like again
    const l2 = await request(app).post(`/api/profile/like/${userB.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(l2.statusCode).toBe(200);
    expect(l2.body.user).toBeDefined();
    expect(typeof l2.body.liked).toBe('boolean');

    const after = await User.findById(userB.id);
    expect(after.fame_rating).toBeDefined();
    expect(after.fame_rating).toBeGreaterThanOrEqual(0);
    expect(after.fame_rating).toBeLessThanOrEqual(100);
  });

  test('Manual location update', async () => {
    const res = await request(app).put('/api/profile/location').set('Authorization', `Bearer ${tokenA}`).send({ latitude: 48.8566, longitude: 2.3522, city: 'Paris', country: 'France' });
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.city).toBe('Paris');
  });
});
