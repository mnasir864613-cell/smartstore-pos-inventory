import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// In production (Neon), SSL is required.
// In development (localhost), SSL is off.
const isProduction = process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction && { ssl: { rejectUnauthorized: false } }),
});

export const query = (text, params) => pool.query(text, params);
