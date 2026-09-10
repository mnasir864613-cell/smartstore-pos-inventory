import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Register new user (Admin or Cashier)
router.post(
  '/register',
  validateBody({
    name: { required: true, type: 'string' },
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string' },
    role: { required: true, enum: ['admin', 'cashier'] }
  }),
  async (req, res, next) => {
    const { name, email, password, role, store_id } = req.body;
    try {
      // Check existing email
      const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'ConflictError', message: 'Email is already registered' });
      }

      const hash = await bcrypt.hash(password, 12);
      const storeId = store_id || 1;

      const result = await query(
        `INSERT INTO users (store_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, store_id, name, email, role, created_at`,
        [storeId, name.trim(), email.trim().toLowerCase(), hash, role]
      );

      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, role: user.role, store_id: user.store_id, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user
      });
    } catch (err) {
      next(err);
    }
  }
);

// Login
router.post(
  '/login',
  validateBody({
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { email, password } = req.body;
    try {
      const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, store_id: user.store_id, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          store_id: user.store_id,
          name: user.name,
          email: user.email,
          role: user.role,
          created_at: user.created_at
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get current logged-in user profile
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, store_id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
