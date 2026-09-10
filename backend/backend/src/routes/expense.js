import express from 'express';
import { query } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List expenses with category and date filtering
router.get('/', async (req, res, next) => {
  const { category, from_date, to_date } = req.query;
  const conditions = [];
  const params = [];

  if (category) {
    params.push(category.trim());
    conditions.push(`category ILIKE $${params.length}`);
  }

  if (from_date) {
    params.push(from_date);
    conditions.push(`expense_date >= $${params.length}`);
  }

  if (to_date) {
    params.push(to_date);
    conditions.push(`expense_date <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(`
      SELECT *
      FROM expenses
      ${whereClause}
      ORDER BY expense_date DESC, id DESC
    `, params);

    const totalRes = await query(`
      SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS total_amount
      FROM expenses
      ${whereClause}
    `, params);

    res.json({
      total_amount: totalRes.rows[0].total_amount,
      expenses: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// Get single expense by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create expense (Admin only)
router.post(
  '/',
  authorizeRoles('admin'),
  validateBody({
    category: { required: true, type: 'string' },
    amount: { required: true, type: 'number', min: 0.01 }
  }),
  async (req, res, next) => {
    const { category, amount, expense_date, description, store_id } = req.body;
    const storeId = store_id || req.user.store_id || 1;
    const date = expense_date || new Date().toISOString().split('T')[0];

    try {
      const result = await query(
        `INSERT INTO expenses (store_id, category, amount, expense_date, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [storeId, category.trim(), Number(amount), date, description ? description.trim() : null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Update expense (Admin only)
router.put(
  '/:id',
  authorizeRoles('admin'),
  validateBody({
    category: { required: true, type: 'string' },
    amount: { required: true, type: 'number', min: 0.01 }
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const { category, amount, expense_date, description } = req.body;

    try {
      const result = await query(
        `UPDATE expenses SET
           category = $1,
           amount = $2,
           expense_date = COALESCE($3, expense_date),
           description = $4
         WHERE id = $5
         RETURNING *`,
        [category.trim(), Number(amount), expense_date || null, description ? description.trim() : null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Expense not found' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Delete expense (Admin only)
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully', expense: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
