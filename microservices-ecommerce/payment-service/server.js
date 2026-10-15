const express = require('express');
const cors = require('cors');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 8004;
const SERVICE_NAME = 'Payment Processing Microservice';
const DB_PATH = path.join(__dirname, 'payment_service.db');

app.use(cors());
app.use(express.json());

// Isolated Database per Service
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    transaction_ref TEXT UNIQUE NOT NULL,
    gateway_auth_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Request telemetry logger with correlation ID
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'trace-local';
  res.setHeader('X-Served-By', `${SERVICE_NAME} on Port ${PORT}`);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Health Endpoint
app.get('/health', (req, res) => {
  const paymentCount = db.prepare('SELECT COUNT(*) as c FROM payments').get().c;
  res.json({
    service: SERVICE_NAME,
    status: 'UP',
    port: PORT,
    database: {
      engine: 'Isolated SQLite per Service',
      file: path.basename(DB_PATH),
      records: paymentCount
    },
    uptime: Math.floor(process.uptime())
  });
});

// Process Payment / Charge (Invoked by Order Microservice or API Gateway)
app.post('/payments/charge', (req, res) => {
  const { orderId, amount, method = 'Credit Card' } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ success: false, message: 'orderId and amount are required' });
  }

  // Generate unique transaction references
  const txRef = 'TX-MS-' + Math.floor(10000000 + Math.random() * 90000000);
  const authCode = 'AUTH-' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const insert = db.prepare(`
    INSERT INTO payments (order_id, amount, currency, method, status, transaction_ref, gateway_auth_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(String(orderId), Number(amount), 'USD', method, 'APPROVED', txRef, authCode);

  const paymentRecord = db.prepare('SELECT * FROM payments WHERE transaction_ref = ?').get(txRef);

  res.json({
    success: true,
    message: 'Payment charged and ledgered in Payment Microservice Database',
    payment: {
      id: paymentRecord.id,
      orderId: paymentRecord.order_id,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      method: paymentRecord.method,
      status: paymentRecord.status,
      transactionRef: paymentRecord.transaction_ref,
      authCode: paymentRecord.gateway_auth_code,
      processedAt: paymentRecord.created_at
    }
  });
});

// Get Payment for Order
app.get('/payments/order/:orderId', (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(String(req.params.orderId));
  if (!payment) return res.status(404).json({ success: false, message: 'No payment record found for this order' });
  res.json({ success: true, payment });
});

// List All Payments
app.get('/payments/history', (req, res) => {
  const list = db.prepare('SELECT * FROM payments ORDER BY id DESC LIMIT 50').all();
  res.json({ success: true, count: list.length, payments: list });
});

app.listen(PORT, () => {
  console.log(`[Payment Service] Running on http://localhost:${PORT} (DB: ${path.basename(DB_PATH)})`);
});
