const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: DB_HOST || 'localhost',
      port: DB_PORT || 5432,
      database: DB_NAME || 'matcha',
      user: DB_USER || 'matcha',
      password: DB_PASSWORD || 'matchapass'
    },
    migrations: {
      directory: './src/migrations'
    },
    seeds: {
      directory: './src/seeds'
    }
  },
  production: {
    client: 'postgresql',
    connection: {
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD
    },
    migrations: {
      directory: './src/migrations'
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};