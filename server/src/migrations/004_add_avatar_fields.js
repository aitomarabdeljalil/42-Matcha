exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.string('avatar_url').nullable();
    table.timestamp('avatar_updated_at').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('avatar_url');
    table.dropColumn('avatar_updated_at');
  });
};
