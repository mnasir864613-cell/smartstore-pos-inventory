import express from 'express';
import { query, pool } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List purchase history
router.get('/', async (req, res, next) => {
  const { supplier_id, from_date, to_date } = req.query;
  const conditions = [];
  const params = [];

  if (supplier_id) {
    params.push(supplier_id);
    conditions.push(`p.supplier_id = $${params.length}`);
  }

  if (from_date) {
    params.push(from_date);
    conditions.push(`p.purchase_date >= $${params.length}`);
  }

  if (to_date) {
    params.push(to_date);
    conditions.push(`p.purchase_date <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(`
      SELECT
        p.*,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        COUNT(pi.id)::int AS item_count,
        COALESCE(SUM(pi.quantity), 0)::int AS total_units
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      ${whereClause}
      GROUP BY p.id, s.name, s.phone
      ORDER BY p.purchase_date DESC, p.id DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get purchase details by ID with line items
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const purchaseRes = await query(`
      SELECT
        p.*,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        s.address AS supplier_address
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = $1
    `, [id]);

    if (purchaseRes.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Purchase not found' });
    }

    const itemsRes = await query(`
      SELECT
        pi.*,
        pr.name AS product_name,
        pr.sku AS product_sku,
        pr.barcode AS product_barcode,
        pr.unit AS product_unit
      FROM purchase_items pi
      JOIN products pr ON pr.id = pi.product_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.id ASC
    `, [id]);

    res.json({
      ...purchaseRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// Create purchase order (Stock In transaction) - Admin only
router.post(
  '/',
  authorizeRoles('admin'),
  validateBody({
    items: { required: true, type: 'array', minLength: 1 }
  }),
  async (req, res, next) => {
    const { supplier_id, invoice_number, purchase_date, items, store_id } = req.body;
    const storeId = store_id || req.user.store_id || 1;

    // Validate items structure
    let calculatedTotal = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.product_id || !it.quantity || !it.unit_price) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Item at index ${i} must have product_id, quantity (>0), and unit_price (>=0)`
        });
      }
      if (Number(it.quantity) <= 0 || Number(it.unit_price) < 0) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Item at index ${i} quantity must be > 0 and unit_price >= 0`
        });
      }
      calculatedTotal += Number(it.quantity) * Number(it.unit_price);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert purchase header
      const pDate = purchase_date || new Date().toISOString().split('T')[0];
      const purchaseRes = await client.query(
        `INSERT INTO purchases (store_id, supplier_id, invoice_number, purchase_date, total_amount)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [storeId, supplier_id || null, invoice_number || null, pDate, calculatedTotal]
      );
      const purchase = purchaseRes.rows[0];

      const insertedItems = [];

      for (const item of items) {
        const qty = Number(item.quantity);
        const uPrice = Number(item.unit_price);
        const batchNum = item.batch_number ? String(item.batch_number).trim() : null;
        const expiryDt = item.expiry_date || null;

        // Insert line item
        const itemRes = await client.query(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, batch_number, expiry_date)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [purchase.id, item.product_id, qty, uPrice, batchNum, expiryDt]
        );
        insertedItems.push(itemRes.rows[0]);

        // Automatically increase product stock and optionally update purchase price / batch / expiry
        const updateProdRes = await client.query(
          `UPDATE products SET
             stock = stock + $1,
             purchase_price = $2,
             batch_number = COALESCE($3, batch_number),
             expiry_date = COALESCE($4, expiry_date),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $5
           RETURNING id, name, stock`,
          [qty, uPrice, batchNum, expiryDt, item.product_id]
        );

        if (updateProdRes.rows.length === 0) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }

        // Insert stock movement record
        await client.query(
          `INSERT INTO stock_movements (store_id, product_id, type, quantity, reference_id, note)
           VALUES ($1, $2, 'in', $3, $4, $5)`,
          [
            storeId,
            item.product_id,
            qty,
            purchase.id,
            `Purchase Invoice #${invoice_number || purchase.id}`
          ]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Purchase created successfully and inventory updated',
        purchase: {
          ...purchase,
          items: insertedItems
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

export default router;
