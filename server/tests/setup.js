const knex = require('knex')(require('../knexfile').test);

beforeAll(async () => {
  await knex.migrate.latest();
  await knex.seed.run();
});

afterAll(async () => {
  await knex.destroy();
});
