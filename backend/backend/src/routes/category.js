import express from 'express';
import { query } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List all categories with product count
router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT c.*, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get category by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT c.*, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create category (Admin only)
router.post(
  '/',
  authorizeRoles('admin'),
  validateBody({
    name: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { name, description, store_id } = req.body;
    const storeId = store_id || req.user.store_id || 1;
    try {
      const result = await query(
        `INSERT INTO categories (store_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [storeId, name.trim(), description || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Update category (Admin only)
router.put(
  '/:id',
  authorizeRoles('admin'),
  validateBody({
    name: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
      const result = await query(
        `UPDATE categories
         SET name = $1, description = $2
         WHERE id = $3
         RETURNING *`,
        [name.trim(), description !== undefined ? description : null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Category not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Delete category (Admin only)
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully', category: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
