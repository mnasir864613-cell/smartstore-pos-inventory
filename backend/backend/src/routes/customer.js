import express from 'express';
import { query, pool } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List all customers (search by name/phone, filter by has_credit)
router.get('/', async (req, res, next) => {
  const { search, has_credit } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`);
  }

  if (has_credit === 'true') {
    conditions.push('c.credit_balance > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(`
      SELECT c.*,
             COUNT(s.id)::int AS total_sales_count,
             COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS total_sales_amount
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.name ASC
    `, params);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get customer by ID (with recent sales)
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const customerRes = await query('SELECT * FROM customers WHERE id = $1', [id]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
    }

    const salesRes = await query(
      `SELECT id, sale_date, total_amount, payment_method, created_at
       FROM sales
       WHERE customer_id = $1
       ORDER BY sale_date DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      ...customerRes.rows[0],
      recent_sales: salesRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// Create customer
router.post(
  '/',
  validateBody({
    name: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { name, phone, address, credit_balance, store_id } = req.body;
    const storeId = store_id || req.user.store_id || 1;
    const balance = credit_balance !== undefined ? Number(credit_balance) : 0;

    try {
      const result = await query(
        `INSERT INTO customers (store_id, name, phone, address, credit_balance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [storeId, name.trim(), phone ? phone.trim() : null, address ? address.trim() : null, balance]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Update customer
router.put(
  '/:id',
  validateBody({
    name: { required: true, type: 'string' }
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const { name, phone, address, credit_balance } = req.body;
    try {
      let q = `UPDATE customers SET name = $1, phone = $2, address = $3`;
      const params = [name.trim(), phone ? phone.trim() : null, address ? address.trim() : null];

      if (credit_balance !== undefined) {
        params.push(Number(credit_balance));
        q += `, credit_balance = $${params.length}`;
      }

      params.push(id);
      q += ` WHERE id = $${params.length} RETURNING *`;

      const result = await query(q, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Record customer payment towards Udhaar / credit balance
router.post(
  '/:id/pay-credit',
  validateBody({
    amount: { required: true, type: 'number', min: 0.01 }
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const amount = Number(req.body.amount);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const custRes = await client.query(
        'SELECT id, name, credit_balance FROM customers WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (custRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
      }

      const customer = custRes.rows[0];
      const previousBalance = Number(customer.credit_balance);
      const newBalance = Math.max(0, previousBalance - amount);

      const updateRes = await client.query(
        'UPDATE customers SET credit_balance = $1 WHERE id = $2 RETURNING *',
        [newBalance, id]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Credit payment recorded successfully',
        customer: updateRes.rows[0],
        payment: {
          paid_amount: amount,
          previous_balance: previousBalance,
          remaining_balance: newBalance
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// Delete customer (Admin only)
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully', customer: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
