import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

// Dashboard summary stats
router.get('/summary', async (req, res, next) => {
  try {
    // Today's sales & gross profit (revenue minus cost of goods sold today)
    const todaySalesRes = await query(`
      SELECT
        COALESCE(COUNT(DISTINCT s.id), 0)::int AS today_orders_count,
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS today_sales_revenue,
        COALESCE(SUM(si.quantity * p.purchase_price), 0)::numeric(12,2) AS today_cogs
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.sale_date::date = CURRENT_DATE
    `);

    const todaySales = todaySalesRes.rows[0];
    const todayRevenue = Number(todaySales.today_sales_revenue);
    const todayCogs = Number(todaySales.today_cogs);

    // Today's expenses
    const todayExpRes = await query(`
      SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS today_expenses
      FROM expenses
      WHERE expense_date = CURRENT_DATE
    `);
    const todayExpenses = Number(todayExpRes.rows[0].today_expenses);

    // Today's Net Profit: (Revenue - COGS - Expenses)
    const todayGrossProfit = todayRevenue - todayCogs;
    const todayNetProfit = todayGrossProfit - todayExpenses;

    // Total products, low stock count, expired count, near expiry count
    const prodCountsRes = await query(`
      SELECT
        COUNT(*)::int AS total_products,
        COUNT(CASE WHEN stock <= min_stock THEN 1 END)::int AS low_stock_count,
        COUNT(CASE WHEN stock <= 0 THEN 1 END)::int AS out_of_stock_count,
        COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE THEN 1 END)::int AS expired_count,
        COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::int AS near_expiry_count
      FROM products
    `);

    // Lifetime / Total purchases
    const purchasesRes = await query(`
      SELECT
        COUNT(*)::int AS total_purchase_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) AS total_purchases_amount
      FROM purchases
    `);

    // Lifetime / Total expenses
    const expensesRes = await query(`
      SELECT
        COUNT(*)::int AS total_expense_records,
        COALESCE(SUM(amount), 0)::numeric(12,2) AS total_expenses_amount
      FROM expenses
    `);

    // Total sales lifetime
    const lifetimeSalesRes = await query(`
      SELECT
        COUNT(*)::int AS total_sales_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) AS total_sales_amount
      FROM sales
    `);

    // Total customer Udhaar / credit balance outstanding
    const customerCreditRes = await query(`
      SELECT
        COUNT(CASE WHEN credit_balance > 0 THEN 1 END)::int AS customers_with_udhaar,
        COALESCE(SUM(credit_balance), 0)::numeric(12,2) AS total_outstanding_udhaar
      FROM customers
    `);

    res.json({
      today: {
        orders_count: todaySales.today_orders_count,
        sales_revenue: todayRevenue.toFixed(2),
        cogs: todayCogs.toFixed(2),
        expenses: todayExpenses.toFixed(2),
        gross_profit: todayGrossProfit.toFixed(2),
        net_profit: todayNetProfit.toFixed(2)
      },
      products: prodCountsRes.rows[0],
      purchases: purchasesRes.rows[0],
      expenses: expensesRes.rows[0],
      sales_lifetime: lifetimeSalesRes.rows[0],
      udhaar: customerCreditRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// Recent activity feed
router.get('/recent', async (req, res, next) => {
  try {
    const recentSales = await query(`
      SELECT s.id, s.sale_date, s.total_amount, s.payment_method, c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.sale_date DESC
      LIMIT 5
    `);

    const recentMovements = await query(`
      SELECT sm.id, sm.type, sm.quantity, sm.moved_at, sm.note, p.name AS product_name
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      ORDER BY sm.moved_at DESC
      LIMIT 5
    `);

    res.json({
      recent_sales: recentSales.rows,
      recent_stock_movements: recentMovements.rows
    });
  } catch (err) {
    next(err);
  }
});

export default router;
