import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max concurrent connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(-1);
});

/**
 * Execute a standalone query
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Acquire a client from the pool for manual transactions (BEGIN, COMMIT, ROLLBACK)
 */
export const getClient = () => pool.connect();

export default pool;