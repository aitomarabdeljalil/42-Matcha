exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    // New profile fields
    table.json('sexual_preferences');
    table.text('biography');
    table.json('interests');
    table.json('photos');

    // Tracking columns
    table.integer('profile_views').defaultTo(0);
    table.integer('likes_count').defaultTo(0);
    table.integer('fame_rating').defaultTo(0);

    // Location additions
    table.string('city');
    table.string('country');
    table.string('location_source'); // gps | ip | manual

    // Profile completion
    table.integer('profile_completion').defaultTo(0);
    table.timestamp('location_updated_at');
  })
  .then(() => {
    return knex.schema.createTable('profile_views', function(table) {
      table.increments('id').primary();
      table.integer('viewer_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('viewed_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  })
  .then(() => {
    return knex.schema.createTable('profile_likes', function(table) {
      table.increments('id').primary();
      table.integer('liker_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('liked_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['liker_id','liked_id']);
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('profile_likes')
    .then(() => knex.schema.dropTableIfExists('profile_views'))
    .then(() => knex.schema.alterTable('users', function(table) {
      table.dropColumn('sexual_preferences');
      table.dropColumn('biography');
      table.dropColumn('interests');
      table.dropColumn('photos');
      table.dropColumn('profile_views');
      table.dropColumn('likes_count');
      table.dropColumn('fame_rating');
      table.dropColumn('city');
      table.dropColumn('country');
      table.dropColumn('location_source');
      table.dropColumn('profile_completion');
    }));
};
