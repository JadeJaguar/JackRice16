const { Pool } = require('pg');

// DATABASE_URL comes from Tiger Data. It looks like:
// postgres://user:password@host:port/dbname?sslmode=require
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
