process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

const PORT = 4099;
let server;
let BASE_URL = `http://localhost:${PORT}`;

let adminToken = '';
let cashierToken = '';
let createdCategoryId = null;
let createdSupplierId = null;
let createdCustomerId = null;
let createdProductId = null;
let expiredProductId = null;
let createdPurchaseId = null;
let createdSaleId = null;
let createdExpenseId = null;

let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passedTests++;
    results.push({ status: 'PASS', message });
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    results.push({ status: 'FAIL', message });
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('Starting SmartStore POS Backend Integration Tests...');
  console.log('====================================================\n');

  // Start HTTP Server for tests
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on ${BASE_URL}`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // MODULE 1: Health Check
    // -------------------------------------------------------------
    console.log('\n--- Module: Health Check ---');
    {
      const res = await request('/health');
      assert(res.status === 200 && res.data.status === 'ok', 'GET /health returns 200 ok');

      const resApi = await request('/api/health');
      assert(resApi.status === 200 && resApi.data.status === 'ok', 'GET /api/health returns 200 ok');
    }

    // -------------------------------------------------------------
    // MODULE 2: Authentication & Role-Based Access Control
    // -------------------------------------------------------------
    console.log('\n--- Module: Authentication & RBAC ---');
    const testAdminEmail = `admin_${Date.now()}@smartstore.com`;
    const testCashierEmail = `cashier_${Date.now()}@smartstore.com`;

    {
      // Register Admin
      const regAdmin = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Super Admin',
          email: testAdminEmail,
          password: 'AdminPassword123!',
          role: 'admin'
        }
      });
      assert(regAdmin.status === 201, 'POST /api/auth/register (admin) returns 201');
      assert(!!regAdmin.data.token, 'Admin registration returns JWT token');
      adminToken = regAdmin.data.token;

      // Duplicate registration check
      const regDup = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Super Admin 2',
          email: testAdminEmail,
          password: 'AdminPassword123!',
          role: 'admin'
        }
      });
      assert(regDup.status === 409, 'POST /api/auth/register with duplicate email returns 409 Conflict');

      // Register Cashier
      const regCashier = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Jane Cashier',
          email: testCashierEmail,
          password: 'CashierPassword123!',
          role: 'cashier'
        }
      });
      assert(regCashier.status === 201, 'POST /api/auth/register (cashier) returns 201');
      cashierToken = regCashier.data.token;

      // Login Admin
      const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testAdminEmail,
          password: 'AdminPassword123!'
        }
      });
      assert(loginRes.status === 200 && !!loginRes.data.token, 'POST /api/auth/login returns 200 and token');

      // Login Invalid Password
      const loginBad = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testAdminEmail,
          password: 'WrongPassword'
        }
      });
      assert(loginBad.status === 401, 'POST /api/auth/login with wrong password returns 401 Unauthorized');

      // Check current profile GET /api/auth/me
      const meRes = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(meRes.status === 200 && meRes.data.user.role === 'admin', 'GET /api/auth/me returns authenticated user');

      // Unauthenticated access
      const unauthRes = await request('/api/products');
      assert(unauthRes.status === 401, 'GET /api/products without token returns 401 Unauthorized');
    }

    // -------------------------------------------------------------
    // MODULE 3: Categories CRUD
    // -------------------------------------------------------------
    console.log('\n--- Module: Categories ---');
    {
      // Cashier forbidden to create category
      const cashierCat = await request('/api/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: { name: 'Unauthorized Category' }
      });
      assert(cashierCat.status === 403, 'POST /api/categories by Cashier returns 403 Forbidden');

      // Admin creates category
      const createCat = await request('/api/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { name: `Beverages & Snacks ${Date.now()}`, description: 'Cold drinks, juices and snacks' }
      });
      assert(createCat.status === 201 && createCat.data.id, 'POST /api/categories by Admin returns 201');
      createdCategoryId = createCat.data.id;

      // List categories
      const listCats = await request('/api/categories', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(listCats.status === 200 && Array.isArray(listCats.data), 'GET /api/categories returns array');
      assert(listCats.data.some(c => c.id === createdCategoryId), 'Category exists in listing');

      // Get category by ID
      const getCat = await request(`/api/categories/${createdCategoryId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(getCat.status === 200 && getCat.data.id === createdCategoryId, 'GET /api/categories/:id returns category');

      // Update category
      const updCat = await request(`/api/categories/${createdCategoryId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { name: 'Beverages Updated', description: 'Updated description' }
      });
      assert(updCat.status === 200 && updCat.data.name === 'Beverages Updated', 'PUT /api/categories/:id updates category');
    }

    // -------------------------------------------------------------
    // MODULE 4: Suppliers CRUD
    // -------------------------------------------------------------
    console.log('\n--- Module: Suppliers ---');
    {
      const createSupp = await request('/api/suppliers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name: 'Supreme Distributors Ltd',
          phone: '+92-300-1234567',
          address: 'Wholesale Market Block A'
        }
      });
      assert(createSupp.status === 201 && createSupp.data.id, 'POST /api/suppliers returns 201');
      createdSupplierId = createSupp.data.id;

      const listSupps = await request('/api/suppliers', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(listSupps.status === 200 && listSupps.data.some(s => s.id === createdSupplierId), 'GET /api/suppliers lists created supplier');

      const getSupp = await request(`/api/suppliers/${createdSupplierId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(getSupp.status === 200 && getSupp.data.id === createdSupplierId, 'GET /api/suppliers/:id returns supplier details');

      const updSupp = await request(`/api/suppliers/${createdSupplierId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name: 'Supreme Distributors Ltd',
          phone: '+92-300-9999999',
          address: 'Wholesale Market Block B'
        }
      });
      assert(updSupp.status === 200 && updSupp.data.phone === '+92-300-9999999', 'PUT /api/suppliers/:id updates supplier');
    }

    // -------------------------------------------------------------
    // MODULE 5: Customers & Credit/Udhaar Management
    // -------------------------------------------------------------
    console.log('\n--- Module: Customers & Udhaar ---');
    {
      const createCust = await request('/api/customers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: {
          name: 'Tariq Mehmood',
          phone: '0312-7654321',
          address: 'House 14, Street 5',
          credit_balance: 0
        }
      });
      assert(createCust.status === 201 && createCust.data.id, 'POST /api/customers returns 201');
      createdCustomerId = createCust.data.id;
      assert(Number(createCust.data.credit_balance) === 0, 'Customer initial credit_balance is 0');

      // Search customer
      const searchCust = await request('/api/customers?search=Tariq', {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(searchCust.status === 200 && searchCust.data.length > 0, 'GET /api/customers?search=Tariq finds customer');

      // Get customer details
      const getCust = await request(`/api/customers/${createdCustomerId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(getCust.status === 200 && getCust.data.name === 'Tariq Mehmood', 'GET /api/customers/:id returns customer info');
    }

    // -------------------------------------------------------------
    // MODULE 6: Products (Search, Low-stock, Expiry)
    // -------------------------------------------------------------
    console.log('\n--- Module: Products ---');
    const testSku1 = `SKU-RICE-${Date.now()}`;
    const testBarcode1 = `BAR-${Date.now()}`;

    {
      // Create main test product
      const createProd = await request('/api/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name: 'Super Kernel Basmati Rice 5kg',
          category_id: createdCategoryId,
          supplier_id: createdSupplierId,
          sku: testSku1,
          barcode: testBarcode1,
          brand: 'Guard Rice',
          unit: 'bag',
          purchase_price: 1200,
          sale_price: 1500,
          stock: 10,
          min_stock: 5,
          batch_number: 'B2026-01'
        }
      });
      assert(createProd.status === 201 && createProd.data.id, 'POST /api/products returns 201');
      createdProductId = createProd.data.id;
      assert(Number(createProd.data.stock) === 10, 'Initial product stock is 10');

      // Create expired product to test expiry filter
      const createExpProd = await request('/api/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name: 'Organic Yogurt 500g',
          category_id: createdCategoryId,
          sku: `SKU-YOG-${Date.now()}`,
          barcode: `BAR-YOG-${Date.now()}`,
          purchase_price: 80,
          sale_price: 120,
          stock: 2,
          min_stock: 10, // low stock!
          expiry_date: '2025-01-01', // expired!
          batch_number: 'EXP-YOG'
        }
      });
      assert(createExpProd.status === 201, 'POST /api/products (expired item) created');
      expiredProductId = createExpProd.data.id;

      // Search by SKU
      const searchRes = await request(`/api/products?search=${testSku1}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(searchRes.status === 200 && searchRes.data.length === 1, 'Search products by SKU succeeds');
      assert(searchRes.data[0].category_name !== undefined, 'Product includes joined category_name');

      // Low stock filtering
      const lowStockRes = await request('/api/products?low_stock=true', {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(lowStockRes.status === 200 && lowStockRes.data.some(p => p.id === expiredProductId), 'Low-stock filter identifies low stock item');

      // Expiry filtering
      const expFilterRes = await request('/api/products?expiry=expired', {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(expFilterRes.status === 200 && expFilterRes.data.some(p => p.id === expiredProductId), 'Expiry filter identifies expired product');

      // Update product
      const updProd = await request(`/api/products/${createdProductId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name: 'Super Kernel Basmati Rice 5kg (Premium)',
          purchase_price: 1250,
          sale_price: 1550,
          unit: 'bag'
        }
      });
      assert(updProd.status === 200 && Number(updProd.data.sale_price) === 1550, 'PUT /api/products/:id updates price');
    }

    // -------------------------------------------------------------
    // MODULE 7: Purchases (Stock IN Transaction)
    // -------------------------------------------------------------
    console.log('\n--- Module: Purchases & Stock Increase ---');
    {
      // Check baseline stock before purchase
      const prodBefore = await request(`/api/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const stockBefore = Number(prodBefore.data.stock);

      const purchaseRes = await request('/api/purchases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          supplier_id: createdSupplierId,
          invoice_number: `INV-PO-${Date.now()}`,
          purchase_date: new Date().toISOString().split('T')[0],
          items: [
            {
              product_id: createdProductId,
              quantity: 20,
              unit_price: 1250,
              batch_number: 'BATCH-2026-PO'
            }
          ]
        }
      });
      assert(purchaseRes.status === 201, 'POST /api/purchases returns 201');
      createdPurchaseId = purchaseRes.data.purchase.id;

      // Verify product stock increased by exactly 20!
      const prodAfter = await request(`/api/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const stockAfter = Number(prodAfter.data.stock);
      assert(stockAfter === stockBefore + 20, `Stock automatically increased from ${stockBefore} to ${stockAfter} (+20)`);

      // Verify purchase details
      const getPurchase = await request(`/api/purchases/${createdPurchaseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(getPurchase.status === 200 && getPurchase.data.items.length === 1, 'GET /api/purchases/:id returns line items');
    }

    // -------------------------------------------------------------
    // MODULE 8: Sales / POS (Stock OUT & Udhaar Transaction)
    // -------------------------------------------------------------
    console.log('\n--- Module: Sales POS & Stock Decrease ---');
    {
      // 1. Cash Sale
      const prodBeforeCashSale = await request(`/api/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      const stockBeforeCashSale = Number(prodBeforeCashSale.data.stock);

      const cashSaleRes = await request('/api/sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: {
          payment_method: 'cash',
          discount: 50,
          tax: 25,
          items: [
            {
              product_id: createdProductId,
              quantity: 4,
              unit_price: 1550,
              discount: 0
            }
          ]
        }
      });
      assert(cashSaleRes.status === 201, 'POST /api/sales (cash) returns 201');
      createdSaleId = cashSaleRes.data.sale.id;

      // Expected total: (4 * 1550) - 50 + 25 = 6200 - 50 + 25 = 6175
      assert(Number(cashSaleRes.data.sale.total_amount) === 6175, 'Sale subtotal, discount, and tax calculated correctly');

      // Verify product stock decreased by 4
      const prodAfterCashSale = await request(`/api/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      const stockAfterCashSale = Number(prodAfterCashSale.data.stock);
      assert(stockAfterCashSale === stockBeforeCashSale - 4, `Stock automatically decreased from ${stockBeforeCashSale} to ${stockAfterCashSale} (-4)`);

      // 2. Insufficient Stock Validation
      const overSale = await request('/api/sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: {
          payment_method: 'cash',
          items: [
            {
              product_id: createdProductId,
              quantity: 99999, // Way more than available
              unit_price: 1550
            }
          ]
        }
      });
      assert(overSale.status === 400 && overSale.data.error === 'InsufficientStock', 'Sale exceeding available stock rejected with 400 InsufficientStock');

      // 3. Credit / Udhaar Sale
      const custBeforeCredit = await request(`/api/customers/${createdCustomerId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      const balanceBeforeCredit = Number(custBeforeCredit.data.credit_balance);

      const creditSaleRes = await request('/api/sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: {
          customer_id: createdCustomerId,
          payment_method: 'credit',
          items: [
            {
              product_id: createdProductId,
              quantity: 2,
              unit_price: 1550
            }
          ]
        }
      });
      assert(creditSaleRes.status === 201, 'POST /api/sales (credit/Udhaar) returns 201');
      const creditTotal = Number(creditSaleRes.data.sale.total_amount);

      // Verify customer credit balance increased
      const custAfterCredit = await request(`/api/customers/${createdCustomerId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      const balanceAfterCredit = Number(custAfterCredit.data.credit_balance);
      assert(balanceAfterCredit === balanceBeforeCredit + creditTotal, `Customer Udhaar balance increased from ${balanceBeforeCredit} to ${balanceAfterCredit}`);

      // Verify sale receipt details
      const saleDetails = await request(`/api/sales/${createdSaleId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(saleDetails.status === 200 && saleDetails.data.items.length === 1, 'GET /api/sales/:id returns complete receipt line items');
    }

    // -------------------------------------------------------------
    // MODULE 9: Customer Udhaar Repayment
    // -------------------------------------------------------------
    console.log('\n--- Module: Customer Credit Repayment ---');
    {
      const custPrePay = await request(`/api/customers/${createdCustomerId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      const balPre = Number(custPrePay.data.credit_balance);

      const payRes = await request(`/api/customers/${createdCustomerId}/pay-credit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: { amount: 1000 }
      });
      assert(payRes.status === 200, 'POST /api/customers/:id/pay-credit returns 200');
      assert(Number(payRes.data.customer.credit_balance) === balPre - 1000, `Customer credit balance reduced by 1000 to ${payRes.data.customer.credit_balance}`);
    }

    // -------------------------------------------------------------
    // MODULE 10: Inventory Module
    // -------------------------------------------------------------
    console.log('\n--- Module: Inventory ---');
    {
      // Stock overview and valuation
      const stockRes = await request('/api/inventory/stock', {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(stockRes.status === 200 && stockRes.data.summary !== undefined, 'GET /api/inventory/stock returns stock valuation');
      assert(Number(stockRes.data.summary.total_units_in_stock) > 0, 'Total units in stock is greater than 0');

      // Stock movements log
      const movRes = await request(`/api/inventory/movements?product_id=${createdProductId}`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(movRes.status === 200 && movRes.data.length >= 3, 'GET /api/inventory/movements has logged initial, purchase-in, and sale-out entries');

      // Manual stock adjustment (Admin only)
      const currentProd = await request(`/api/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const stockPreAdjust = Number(currentProd.data.stock);

      const adjRes = await request('/api/inventory/adjust', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          product_id: createdProductId,
          adjustment_type: 'subtract',
          quantity: 1,
          note: 'Damaged packaging during shelf stacking'
        }
      });
      assert(adjRes.status === 200, 'POST /api/inventory/adjust returns 200');
      assert(Number(adjRes.data.product.stock) === stockPreAdjust - 1, `Manual stock adjustment reduced stock by 1 to ${stockPreAdjust - 1}`);

      // Expiries endpoint
      const expRes = await request('/api/inventory/expiries', {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(expRes.status === 200 && Array.isArray(expRes.data), 'GET /api/inventory/expiries returns expiring products list');
    }

    // -------------------------------------------------------------
    // MODULE 11: Expenses CRUD
    // -------------------------------------------------------------
    console.log('\n--- Module: Expenses ---');
    {
      const createExp = await request('/api/expenses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          category: 'Utilities',
          amount: 350.50,
          description: 'Monthly electricity bill for store lights and AC'
        }
      });
      assert(createExp.status === 201 && createExp.data.id, 'POST /api/expenses returns 201');
      createdExpenseId = createExp.data.id;

      const listExp = await request('/api/expenses?category=Utilities', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(listExp.status === 200 && Number(listExp.data.total_amount) >= 350.50, 'GET /api/expenses filters and aggregates total');

      const updExp = await request(`/api/expenses/${createdExpenseId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          category: 'Utilities',
          amount: 375.00,
          description: 'Updated bill amount'
        }
      });
      assert(updExp.status === 200 && Number(updExp.data.amount) === 375, 'PUT /api/expenses/:id updates expense');
    }

    // -------------------------------------------------------------
    // MODULE 12: Dashboard & Reports
    // -------------------------------------------------------------
    console.log('\n--- Module: Dashboard & Reports ---');
    {
      const dashRes = await request('/api/dashboard/summary', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(dashRes.status === 200, 'GET /api/dashboard/summary returns 200');
      assert(dashRes.data.today.orders_count >= 2, "Today's orders count reflected on dashboard");
      assert(Number(dashRes.data.today.sales_revenue) > 0, "Today's sales revenue reported");
      assert(dashRes.data.today.gross_profit !== undefined, "Today's gross profit reported");
      assert(dashRes.data.products.total_products >= 2, 'Total products reported on dashboard');
      assert(dashRes.data.products.expired_count >= 1, 'Expired count reported on dashboard');

      const recentRes = await request('/api/dashboard/recent', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(recentRes.status === 200, 'GET /api/dashboard/recent returns 200');
      assert(recentRes.data.recent_sales.length > 0, 'Recent sales list is populated');
      assert(recentRes.data.recent_stock_movements.length > 0, 'Recent stock movements list is populated');
    }

  } catch (error) {
    console.error('Fatal error during test run:', error);
    failedTests++;
  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`Test Execution Finished: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
