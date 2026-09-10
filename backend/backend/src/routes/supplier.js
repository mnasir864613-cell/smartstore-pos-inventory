import express from 'express';
import { query } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List all suppliers
router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT s.*,
             COUNT(p.id)::int AS purchase_count,
             COALESCE(SUM(p.total_amount), 0)::numeric(12,2) AS total_purchased
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get supplier by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT s.*,
             COUNT(p.id)::int AS purchase_count,
             COALESCE(SUM(p.total_amount), 0)::numeric(12,2) AS total_purchased
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.id
      WHERE s.id = $1
      GROUP BY s.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Supplier not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create supplier (Admin only)
router.post(
  '/',
  authorizeRoles('admin'),
  validateBody({
    name: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { name, phone, address, store_id } = req.body;
    const storeId = store_id || req.user.store_id || 1;
    try {
      const result = await query(
        `INSERT INTO suppliers (store_id, name, phone, address)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [storeId, name.trim(), phone ? phone.trim() : null, address ? address.trim() : null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Update supplier (Admin only)
router.put(
  '/:id',
  authorizeRoles('admin'),
  validateBody({
    name: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const { name, phone, address } = req.body;
    try {
      const result = await query(
        `UPDATE suppliers
         SET name = $1,
             phone = $2,
             address = $3
         WHERE id = $4
         RETURNING *`,
        [
          name.trim(),
          phone !== undefined ? (phone ? phone.trim() : null) : null,
          address !== undefined ? (address ? address.trim() : null) : null,
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Supplier not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Delete supplier (Admin only)
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Supplier not found' });
    }
    res.json({ message: 'Supplier deleted successfully', supplier: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
