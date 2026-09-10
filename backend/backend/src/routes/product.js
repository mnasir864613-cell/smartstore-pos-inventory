import express from 'express';
import { query, pool } from '../config/db.js';
import { authorizeRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validator.js';

const router = express.Router();

// List products with search, low-stock, and expiry filtering
router.get('/', async (req, res, next) => {
  const { search, category_id, supplier_id, low_stock, expiry } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.trim()}%`);
    const pIdx = params.length;
    conditions.push(`(p.name ILIKE $${pIdx} OR p.sku ILIKE $${pIdx} OR p.barcode ILIKE $${pIdx} OR p.brand ILIKE $${pIdx})`);
  }

  if (category_id) {
    params.push(category_id);
    conditions.push(`p.category_id = $${params.length}`);
  }

  if (supplier_id) {
    params.push(supplier_id);
    conditions.push(`p.supplier_id = $${params.length}`);
  }

  if (low_stock === 'true') {
    conditions.push('p.stock <= p.min_stock');
  }

  if (expiry === 'expired') {
    conditions.push('p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE');
  } else if (expiry === 'near') {
    conditions.push('p.expiry_date IS NOT NULL AND p.expiry_date >= CURRENT_DATE AND p.expiry_date <= CURRENT_DATE + INTERVAL \'30 days\'');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(`
      SELECT
        p.*,
        c.name AS category_name,
        s.name AS supplier_name,
        CASE
          WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN p.expiry_date IS NOT NULL AND p.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'near_expiry'
          ELSE 'good'
        END AS expiry_status,
        (p.stock * p.purchase_price)::numeric(12,2) AS stock_cost_value,
        (p.stock * p.sale_price)::numeric(12,2) AS stock_retail_value
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      ${whereClause}
      ORDER BY p.id DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get product by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT
        p.*,
        c.name AS category_name,
        s.name AS supplier_name,
        CASE
          WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN p.expiry_date IS NOT NULL AND p.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'near_expiry'
          ELSE 'good'
        END AS expiry_status
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create product (Admin only)
router.post(
  '/',
  authorizeRoles('admin'),
  validateBody({
    name: { required: true, type: 'string' },
    purchase_price: { required: true, type: 'number', min: 0 },
    sale_price: { required: true, type: 'number', min: 0 }
  }),
  async (req, res, next) => {
    const {
      name,
      category_id,
      supplier_id,
      sku,
      barcode,
      brand,
      unit,
      purchase_price,
      sale_price,
      stock = 0,
      min_stock = 0,
      expiry_date,
      batch_number,
      image_url,
      store_id
    } = req.body;

    const storeId = store_id || req.user.store_id || 1;
    const initialStock = Number(stock) || 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertRes = await client.query(
        `INSERT INTO products (
          store_id, category_id, supplier_id, name, sku, barcode, brand,
          unit, purchase_price, sale_price, stock, min_stock,
          expiry_date, batch_number, image_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15
        ) RETURNING *`,
        [
          storeId,
          category_id || null,
          supplier_id || null,
          name.trim(),
          sku ? sku.trim() : null,
          barcode ? barcode.trim() : null,
          brand ? brand.trim() : null,
          unit ? unit.trim() : 'pcs',
          Number(purchase_price),
          Number(sale_price),
          initialStock,
          Number(min_stock) || 0,
          expiry_date || null,
          batch_number ? batch_number.trim() : null,
          image_url || null
        ]
      );

      const product = insertRes.rows[0];

      // Log initial stock movement if > 0
      if (initialStock > 0) {
        await client.query(
          `INSERT INTO stock_movements (store_id, product_id, type, quantity, reference_id, note)
           VALUES ($1, $2, 'in', $3, $4, 'Initial stock entry')`,
          [storeId, product.id, initialStock, product.id]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(product);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// Update product (Admin only)
router.put(
  '/:id',
  authorizeRoles('admin'),
  validateBody({
    name: { required: true, type: 'string' },
    purchase_price: { required: true, type: 'number', min: 0 },
    sale_price: { required: true, type: 'number', min: 0 }
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const {
      name,
      category_id,
      supplier_id,
      sku,
      barcode,
      brand,
      unit,
      purchase_price,
      sale_price,
      stock,
      min_stock,
      expiry_date,
      batch_number,
      image_url
    } = req.body;

    try {
      const updateRes = await query(
        `UPDATE products SET
          name = $1,
          category_id = $2,
          supplier_id = $3,
          sku = $4,
          barcode = $5,
          brand = $6,
          unit = $7,
          purchase_price = $8,
          sale_price = $9,
          stock = COALESCE($10, stock),
          min_stock = COALESCE($11, min_stock),
          expiry_date = $12,
          batch_number = $13,
          image_url = $14,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $15
        RETURNING *`,
        [
          name.trim(),
          category_id || null,
          supplier_id || null,
          sku ? sku.trim() : null,
          barcode ? barcode.trim() : null,
          brand ? brand.trim() : null,
          unit ? unit.trim() : 'pcs',
          Number(purchase_price),
          Number(sale_price),
          stock !== undefined ? Number(stock) : null,
          min_stock !== undefined ? Number(min_stock) : null,
          expiry_date || null,
          batch_number ? batch_number.trim() : null,
          image_url || null,
          id
        ]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
      }

      res.json(updateRes.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// Delete product (Admin only)
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
