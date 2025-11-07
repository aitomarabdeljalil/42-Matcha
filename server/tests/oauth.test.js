const request = require('supertest');
const app = require('../src/app');

describe('OAuth Authentication', () => {
  test('Google OAuth endpoint redirects to Google', async () => {
    const res = await request(app)
      .get('/api/auth/google');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/accounts\.google\.com/);
  });

  // Callback tests would require mocking Passport or using test tokens
  // For full integration, use Passport mock strategy or e2e browser automation
});
