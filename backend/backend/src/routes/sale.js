import express from 'express';
import { query, pool } from '../config/db.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List sales history
router.get('/', async (req, res, next) => {
  const { customer_id, payment_method, from_date, to_date } = req.query;
  const conditions = [];
  const params = [];

  if (customer_id) {
    params.push(customer_id);
    conditions.push(`s.customer_id = $${params.length}`);
  }

  if (payment_method) {
    params.push(payment_method);
    conditions.push(`s.payment_method = $${params.length}`);
  }

  if (from_date) {
    params.push(from_date);
    conditions.push(`s.sale_date >= $${params.length}`);
  }

  if (to_date) {
    params.push(to_date);
    conditions.push(`s.sale_date <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(`
      SELECT
        s.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        u.name AS cashier_name,
        COUNT(si.id)::int AS item_count,
        COALESCE(SUM(si.quantity), 0)::int AS total_units
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      ${whereClause}
      GROUP BY s.id, c.name, c.phone, u.name
      ORDER BY s.sale_date DESC, s.id DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single sale details with line items
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const saleRes = await query(`
      SELECT
        s.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.credit_balance AS customer_current_credit,
        u.name AS cashier_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [id]);

    if (saleRes.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Sale not found' });
    }

    const itemsRes = await query(`
      SELECT
        si.*,
        pr.name AS product_name,
        pr.sku AS product_sku,
        pr.barcode AS product_barcode,
        pr.unit AS product_unit,
        (si.quantity * si.unit_price - si.discount)::numeric(12,2) AS line_total
      FROM sale_items si
      JOIN products pr ON pr.id = si.product_id
      WHERE si.sale_id = $1
      ORDER BY si.id ASC
    `, [id]);

    res.json({
      ...saleRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// Create sale (POS Checkout transaction)
router.post(
  '/',
  validateBody({
    payment_method: { required: true, enum: ['cash', 'credit'] },
    items: { required: true, type: 'array', minLength: 1 }
  }),
  async (req, res, next) => {
    const {
      customer_id,
      payment_method,
      items,
      discount = 0,
      tax = 0,
      store_id
    } = req.body;

    const storeId = store_id || req.user.store_id || 1;
    const userId = req.user.id || null;

    // If payment method is credit (Udhaar), customer_id is strictly required
    if (payment_method === 'credit' && !customer_id) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'A valid customer must be selected for Credit (Udhaar) sales'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify customer exists if provided
      if (customer_id) {
        const custCheck = await client.query('SELECT id, name FROM customers WHERE id = $1', [customer_id]);
        if (custCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'NotFound', message: 'Selected customer not found' });
        }
      }

      // Calculate subtotal and check stock for all items
      let subtotal = 0;
      const verifiedItems = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.product_id || !item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'ValidationError',
            message: `Item at position ${i + 1} must include product_id and quantity`
          });
        }

        const qty = Number(item.quantity);
        if (qty <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'ValidationError',
            message: `Quantity for product at position ${i + 1} must be greater than 0`
          });
        }

        // Lock product row for update to prevent race conditions in stock
        const prodRes = await client.query(
          'SELECT id, name, sale_price, stock FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );

        if (prodRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            error: 'NotFound',
            message: `Product with ID ${item.product_id} not found`
          });
        }

        const product = prodRes.rows[0];

        // Stock availability check
        if (product.stock < qty) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'InsufficientStock',
            message: `Insufficient stock for product '${product.name}'. Available: ${product.stock}, Requested: ${qty}`
          });
        }

        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(product.sale_price);
        const itemDiscount = Number(item.discount) || 0;
        const lineTotal = (qty * unitPrice) - itemDiscount;

        subtotal += lineTotal;

        verifiedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          unit_price: unitPrice,
          discount: itemDiscount,
          line_total: lineTotal
        });
      }

      const overallDiscount = Number(discount) || 0;
      const taxAmount = Number(tax) || 0;
      const totalAmount = Math.max(0, subtotal - overallDiscount + taxAmount);

      // Insert sale record
      const saleRes = await client.query(
        `INSERT INTO sales (store_id, customer_id, user_id, sale_date, subtotal, discount, tax, total_amount, payment_method)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8)
         RETURNING *`,
        [storeId, customer_id || null, userId, subtotal, overallDiscount, taxAmount, totalAmount, payment_method]
      );
      const sale = saleRes.rows[0];

      // Insert sale items, decrement stock, and log stock movement
      const insertedItems = [];
      for (const it of verifiedItems) {
        const itemRes = await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [sale.id, it.product_id, it.quantity, it.unit_price, it.discount]
        );
        insertedItems.push(itemRes.rows[0]);

        // Decrement product stock
        await client.query(
          'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [it.quantity, it.product_id]
        );

        // Record stock movement (type 'out')
        await client.query(
          `INSERT INTO stock_movements (store_id, product_id, type, quantity, reference_id, note)
           VALUES ($1, $2, 'out', $3, $4, $5)`,
          [storeId, it.product_id, it.quantity, sale.id, `POS Sale #${sale.id}`]
        );
      }

      // If credit sale, increment customer credit balance (Udhaar)
      if (payment_method === 'credit' && customer_id) {
        await client.query(
          'UPDATE customers SET credit_balance = credit_balance + $1 WHERE id = $2',
          [totalAmount, customer_id]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Sale completed successfully',
        sale: {
          ...sale,
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
