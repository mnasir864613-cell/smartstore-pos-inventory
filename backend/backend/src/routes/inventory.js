import express from 'express';
import { query, pool } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// Current stock overview with valuation
router.get('/stock', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.brand,
        p.unit,
        p.stock,
        p.min_stock,
        p.purchase_price,
        p.sale_price,
        p.expiry_date,
        p.batch_number,
        c.name AS category_name,
        (p.stock * p.purchase_price)::numeric(12,2) AS total_cost_value,
        (p.stock * p.sale_price)::numeric(12,2) AS total_retail_value,
        CASE
          WHEN p.stock <= 0 THEN 'out_of_stock'
          WHEN p.stock <= p.min_stock THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.stock ASC, p.name ASC
    `);

    // Calculate totals
    let totalItems = 0;
    let totalUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;

    for (const row of result.rows) {
      totalItems += 1;
      totalUnits += Number(row.stock);
      totalCostVal += Number(row.total_cost_value);
      totalRetailVal += Number(row.total_retail_value);
    }

    res.json({
      summary: {
        total_unique_products: totalItems,
        total_units_in_stock: totalUnits,
        total_inventory_cost: totalCostVal.toFixed(2),
        total_inventory_retail: totalRetailVal.toFixed(2),
        potential_profit: (totalRetailVal - totalCostVal).toFixed(2)
      },
      products: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// Stock movements audit log
router.get('/movements', async (req, res, next) => {
  const { product_id, type, limit = 50 } = req.query;
  const conditions = [];
  const params = [];

  if (product_id) {
    params.push(product_id);
    conditions.push(`sm.product_id = $${params.length}`);
  }

  if (type) {
    params.push(type);
    conditions.push(`sm.type = $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 50, 100));
  const limitClause = `LIMIT $${params.length}`;

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(`
      SELECT
        sm.*,
        p.name AS product_name,
        p.sku AS product_sku,
        p.barcode AS product_barcode,
        p.unit AS product_unit
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      ${whereClause}
      ORDER BY sm.moved_at DESC, sm.id DESC
      ${limitClause}
    `, params);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Low-stock products list
router.get('/low-stock', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.*,
        c.name AS category_name,
        s.name AS supplier_name,
        (p.min_stock - p.stock) AS deficit
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.stock <= p.min_stock
      ORDER BY p.stock ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Batch & Expiry tracking
router.get('/expiries', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.batch_number,
        p.expiry_date,
        p.stock,
        c.name AS category_name,
        CASE
          WHEN p.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN p.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'valid'
        END AS status,
        (p.expiry_date - CURRENT_DATE) AS days_until_expiry
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.expiry_date IS NOT NULL AND p.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
      ORDER BY p.expiry_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Manual stock adjustment (Admin only)
router.post(
  '/adjust',
  authorizeRoles('admin'),
  validateBody({
    product_id: { required: true },
    adjustment_type: { required: true, enum: ['add', 'subtract', 'set'] },
    quantity: { required: true, type: 'number', min: 0 }
  }),
  async (req, res, next) => {
    const { product_id, adjustment_type, quantity, note, store_id } = req.body;
    const storeId = store_id || req.user.store_id || 1;
    const qty = Number(quantity);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const prodRes = await client.query(
        'SELECT id, name, stock FROM products WHERE id = $1 FOR UPDATE',
        [product_id]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
      }

      const currentStock = prodRes.rows[0].stock;
      let newStock = currentStock;
      let movedQty = qty;

      if (adjustment_type === 'add') {
        newStock = currentStock + qty;
      } else if (adjustment_type === 'subtract') {
        if (currentStock < qty) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'InvalidAdjustment',
            message: `Cannot subtract ${qty} units. Current stock is only ${currentStock}.`
          });
        }
        newStock = currentStock - qty;
      } else if (adjustment_type === 'set') {
        newStock = qty;
        movedQty = Math.abs(qty - currentStock);
      }

      // Update product stock
      const updatedProd = await client.query(
        'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [newStock, product_id]
      );

      // Record adjustment movement
      const adjustmentNote = note ? `${note} (Manual ${adjustment_type})` : `Manual adjustment: ${adjustment_type} (${currentStock} -> ${newStock})`;
      await client.query(
        `INSERT INTO stock_movements (store_id, product_id, type, quantity, reference_id, note)
         VALUES ($1, $2, 'adjust', $3, $4, $5)`,
        [storeId, product_id, movedQty, product_id, adjustmentNote]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Stock adjusted successfully',
        product: updatedProd.rows[0],
        adjustment: {
          previous_stock: currentStock,
          new_stock: newStock,
          type: adjustment_type,
          note: adjustmentNote
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
