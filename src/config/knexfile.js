const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const migrationsDir = path.resolve(__dirname, '../db/migrations');
const seedsDir = path.resolve(__dirname, '../db/seeds');

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'senior_expert_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    migrations: { directory: migrationsDir },
    seeds: { directory: seedsDir },
  },
  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: (process.env.DB_NAME || 'senior_expert_platform') + '_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    migrations: { directory: migrationsDir },
    seeds: { directory: seedsDir },
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    },
    migrations: { directory: migrationsDir },
  },
};
