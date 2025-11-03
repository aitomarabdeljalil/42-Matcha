exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('email').unique().notNullable();
    table.string('username').notNullable().unique();
    table.string('password').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.date('birth_date').notNullable();
    table.string('gender').notNullable();
    table.string('preferred_gender').notNullable();
    table.text('bio');
    table.string('profile_picture');
    table.decimal('latitude', 10, 7);
    table.decimal('longitude', 10, 7);
    table.boolean('is_verified').defaultTo(false);
    table.boolean('is_profile_complete').defaultTo(false);
    table.timestamp('last_online').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    
    // Indexes for better performance
    table.index(['gender', 'preferred_gender']);
    table.index(['latitude', 'longitude']);
    table.index('last_online');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};