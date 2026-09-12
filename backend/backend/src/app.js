import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter from './routes/auth.js';
import productRouter from './routes/product.js';
import categoryRouter from './routes/category.js';
import supplierRouter from './routes/supplier.js';
import customerRouter from './routes/customer.js';
import purchaseRouter from './routes/purchase.js';
import saleRouter from './routes/sale.js';
import inventoryRouter from './routes/inventory.js';
import expenseRouter from './routes/expense.js';
import dashboardRouter from './routes/dashboard.js';

import { verifyToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Production-safe CORS configuration
// In production: restrict to origins listed in ALLOWED_ORIGINS (comma-separated)
// In development: allow all origins for convenience
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = [
  ...configuredOrigins,
  'https://smartstore-pos-inventory.vercel.app',
  'http://localhost:5173',
  'https://localhost:5173'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (!isProduction) {
      // Development: allow all origins
      return callback(null, true);
    }

    // Production: allow configured origins, Vercel production domain and preview URLs
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }

    callback(new Error(`CORS: Origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Public Health check endpoints (suitable for deployment health monitors)
app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'SmartStore POS API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  })
);
app.get('/api/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'SmartStore POS API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  })
);

// Public Auth routes (register, login) - mounted at /api/auth and alias /auth
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

// Protected REST API routes (Require valid JWT)
app.use('/api/products', verifyToken, productRouter);
app.use('/api/categories', verifyToken, categoryRouter);
app.use('/api/suppliers', verifyToken, supplierRouter);
app.use('/api/customers', verifyToken, customerRouter);
app.use('/api/purchases', verifyToken, purchaseRouter);
app.use('/api/sales', verifyToken, saleRouter);
app.use('/api/inventory', verifyToken, inventoryRouter);
app.use('/api/expenses', verifyToken, expenseRouter);
app.use('/api/dashboard', verifyToken, dashboardRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NotFound', message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/src/app.js');
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`SmartStore backend listening on http://localhost:${PORT}`);
  });
}

export default app;
