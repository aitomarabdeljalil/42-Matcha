const bcrypt = require('bcryptjs');

/**
 * Seed mock users, profile views and likes for local development and tests.
 */
exports.seed = async function(knex) {
  // Clean tables (order matters because of foreign keys)
  await knex('profile_likes').del().catch(() => {});
  await knex('profile_views').del().catch(() => {});
  await knex('users').del();

  const pwd = bcrypt.hashSync('Password1!', 10);

  const users = [
    {
      email: 'alice@example.com',
      username: 'alice',
      password: pwd,
      first_name: 'Alice',
      last_name: 'Anderson',
      birth_date: '1992-01-01',
      gender: 'female',
      preferred_gender: 'male',
      biography: 'Hi I am Alice',
      sexual_preferences: JSON.stringify(['men']),
      interests: JSON.stringify(['hiking','music']),
      photos: JSON.stringify(['https://example.com/a1.jpg','https://example.com/a2.jpg']),
      profile_views: 2,
      likes_count: 1,
      fame_rating: 20,
      city: 'Paris',
      country: 'France',
      location_source: 'manual',
      profile_completion: 60
    },
    {
      email: 'bob@example.com',
      username: 'bob',
      password: pwd,
      first_name: 'Bob',
      last_name: 'Barker',
      birth_date: '1990-01-01',
      gender: 'male',
      preferred_gender: 'female',
      biography: 'Bob here',
      sexual_preferences: JSON.stringify(['women']),
      interests: JSON.stringify(['cooking','travel']),
      photos: JSON.stringify(['https://example.com/b1.jpg']),
      profile_views: 1,
      likes_count: 2,
      fame_rating: 30,
      city: 'London',
      country: 'UK',
      location_source: 'ip',
      profile_completion: 50
    },
    {
      email: 'carol@example.com',
      username: 'carol',
      password: pwd,
      first_name: 'Carol',
      last_name: 'Clark',
      birth_date: '1995-05-05',
      gender: 'female',
      preferred_gender: 'female',
      biography: 'Love cats',
      sexual_preferences: JSON.stringify(['women']),
      interests: JSON.stringify(['cats','photography']),
      photos: JSON.stringify([]),
      profile_views: 0,
      likes_count: 0,
      fame_rating: 10,
      city: null,
      country: null,
      location_source: null,
      profile_completion: 20
    }
  ];

  await knex('users').insert(users);

  // Fetch inserted users (sqlite doesn't support .returning in older versions)
  const inserted = await knex('users').select('*');

  const alice = inserted.find(u => u.email === 'alice@example.com');
  const bob = inserted.find(u => u.email === 'bob@example.com');
  const carol = inserted.find(u => u.email === 'carol@example.com');

  if (alice && bob) {
    // create some views and likes
    await knex('profile_views').insert([
      { viewer_id: bob.id, viewed_id: alice.id },
      { viewer_id: carol.id, viewed_id: alice.id }
    ]).catch(() => {});

    await knex('profile_likes').insert([
      { liker_id: bob.id, liked_id: alice.id }
    ]).catch(() => {});

    // update counts to match
    await knex('users').where({ id: alice.id }).update({ profile_views: 2, likes_count: 1 });
  }

  if (bob && carol) {
    await knex('profile_likes').insert([{ liker_id: alice.id, liked_id: bob.id }]).catch(() => {});
    await knex('users').where({ id: bob.id }).update({ likes_count: 1 });
  }
};
