const express = require('express');
const cors = require('cors');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 8003;
const SERVICE_NAME = 'Order & Cart Microservice';
const DB_PATH = path.join(__dirname, 'order_service.db');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:8001';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8004';

app.use(cors());
app.use(express.json());

// Isolated Database per Service
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    shipping_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_zip TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    payment_tx_ref TEXT,
    order_status TEXT DEFAULT 'Confirmed',
    correlation_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
`);

// Request telemetry logger with correlation ID
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `corr-${Date.now()}`;
  req.correlationId = correlationId;
  res.setHeader('X-Served-By', `${SERVICE_NAME} on Port ${PORT}`);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Health Endpoint
app.get('/health', (req, res) => {
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const cartCount = db.prepare('SELECT COUNT(*) as c FROM cart').get().c;
  res.json({
    service: SERVICE_NAME,
    status: 'UP',
    port: PORT,
    dependencies: {
      productService: PRODUCT_SERVICE_URL,
      paymentService: PAYMENT_SERVICE_URL
    },
    database: {
      engine: 'Isolated SQLite per Service',
      file: path.basename(DB_PATH),
      records: { orders: orderCount, cart: cartCount }
    },
    uptime: Math.floor(process.uptime())
  });
});

// Cart Endpoints
app.get('/cart', (req, res) => {
  const userId = req.query.userId || 1;
  const items = db.prepare('SELECT * FROM cart WHERE user_id = ?').all(userId);
  const subtotal = items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const tax = +(subtotal * 0.08).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  res.json({
    success: true,
    items,
    itemCount: items.reduce((acc, it) => acc + it.quantity, 0),
    summary: { subtotal: +subtotal.toFixed(2), tax, total }
  });
});

app.post('/cart/add', async (req, res) => {
  const { userId = 1, productId, quantity = 1 } = req.body;

  try {
    // 1. In Microservices, we query the Product Service via REST HTTP
    const prodRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`, {
      headers: { 'X-Correlation-ID': req.correlationId }
    });
    const prodData = await prodRes.json();

    if (!prodData.success || !prodData.data) {
      return res.status(404).json({ success: false, message: 'Product not found in Product Microservice' });
    }

    const prod = prodData.data;
    const existing = db.prepare('SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?').get(userId, productId);

    if (existing) {
      const newQty = existing.quantity + quantity;
      db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart (user_id, product_id, title, price, image, category, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, prod.id, prod.title, prod.price, prod.image, prod.category, quantity);
    }

    res.json({ success: true, message: 'Item added to Microservice Cart' });
  } catch (err) {
    console.error('Order-Service Add to cart error:', err);
    res.status(500).json({ success: false, message: 'Failed to communicate with Product Microservice: ' + err.message });
  }
});

app.post('/cart/update', (req, res) => {
  const { cartId, quantity } = req.body;
  if (quantity <= 0) {
    db.prepare('DELETE FROM cart WHERE id = ?').run(cartId);
  } else {
    db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(quantity, cartId);
  }
  res.json({ success: true, message: 'Cart updated' });
});

app.delete('/cart/:cartId', (req, res) => {
  db.prepare('DELETE FROM cart WHERE id = ?').run(req.params.cartId);
  res.json({ success: true, message: 'Cart item removed' });
});

// ==========================================
// DISTRIBUTED CHECKOUT SAGA ORCHESTRATION
// Communicates with Product Microservice (:8001) and Payment Microservice (:8004)
// ==========================================
app.post('/orders/checkout', async (req, res) => {
  const {
    userId = 1,
    shippingName = 'Alex Turner',
    shippingAddress = '742 Evergreen Terrace',
    shippingCity = 'Springfield',
    shippingZip = '97477',
    paymentMethod = 'Credit Card',
    discountCode
  } = req.body;

  const traceSteps = [];
  const startTotal = performance.now();

  try {
    // STEP 1: Fetch local cart items from Order Service DB
    const cartItems = db.prepare('SELECT * FROM cart WHERE user_id = ?').all(userId);
    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    traceSteps.push({
      step: 1,
      service: 'Order Microservice (:8003)',
      action: 'Fetch Cart State from Local DB',
      itemsCount: cartItems.length
    });

    // STEP 2: Distributed Inventory Deduction via Product Microservice HTTP API
    for (const item of cartItems) {
      const stockStart = performance.now();
      const stockRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${item.product_id}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': req.correlationId
        },
        body: JSON.stringify({ deductQuantity: item.quantity })
      });
      const stockData = await stockRes.json();

      if (!stockData.success) {
        throw new Error(`Inventory deduction failed for ${item.title}: ${stockData.message}`);
      }

      traceSteps.push({
        step: 2,
        service: 'Product Microservice (:8001)',
        action: `HTTP PUT /products/${item.product_id}/stock`,
        latencyMs: +(performance.now() - stockStart).toFixed(2),
        status: 'Inventory Reserved'
      });
    }

    // STEP 3: Financial Computations
    const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    let discount = 0;
    if (discountCode === 'SAVE10') discount = subtotal * 0.10;
    else if (discountCode === 'MICRO20') discount = subtotal * 0.20;
    const tax = (subtotal - discount) * 0.08;
    const totalAmount = +(subtotal - discount + tax).toFixed(2);
    const orderNumber = 'MS-ORD-' + Math.floor(100000 + Math.random() * 900000);

    // STEP 4: Call Payment Microservice via REST HTTP
    const payStart = performance.now();
    const payRes = await fetch(`${PAYMENT_SERVICE_URL}/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': req.correlationId
      },
      body: JSON.stringify({
        orderId: orderNumber,
        amount: totalAmount,
        method: paymentMethod
      })
    });
    const payData = await payRes.json();

    if (!payData.success) {
      throw new Error(`Payment Microservice authorization failed: ${payData.message}`);
    }

    traceSteps.push({
      step: 3,
      service: 'Payment Microservice (:8004)',
      action: 'HTTP POST /payments/charge',
      latencyMs: +(performance.now() - payStart).toFixed(2),
      txRef: payData.payment.transactionRef,
      authCode: payData.payment.authCode,
      status: 'Payment Approved'
    });

    // STEP 5: Commit Order locally in Order Microservice DB
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, subtotal, discount, total_amount,
        shipping_name, shipping_address, shipping_city, shipping_zip,
        payment_method, payment_status, payment_tx_ref, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run(
      orderNumber, userId, +subtotal.toFixed(2), +discount.toFixed(2), totalAmount,
      shippingName, shippingAddress, shippingCity, shippingZip,
      paymentMethod, 'PAID_APPROVED', payData.payment.transactionRef, req.correlationId
    );

    const order = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, title, price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of cartItems) {
      insertItem.run(order.id, item.product_id, item.title, item.price, item.quantity);
    }

    // STEP 6: Clear Cart
    db.prepare('DELETE FROM cart WHERE user_id = ?').run(userId);

    traceSteps.push({
      step: 4,
      service: 'Order Microservice (:8003)',
      action: 'Commit Order & Clear Cart in Local DB',
      status: 'Order Finalized'
    });

    const totalDurationMs = +(performance.now() - startTotal).toFixed(2);

    res.json({
      success: true,
      message: 'Distributed checkout completed via multi-service Saga workflow!',
      order: {
        orderId: order.id,
        orderNumber,
        totalAmount,
        paymentStatus: 'PAID_APPROVED',
        transactionRef: payData.payment.transactionRef,
        correlationId: req.correlationId,
        itemsCount: cartItems.length,
        totalDurationMs,
        sagaTraceSteps: traceSteps
      }
    });

  } catch (error) {
    console.error('Distributed Checkout Saga Failed:', error);
    res.status(500).json({
      success: false,
      message: 'Distributed transaction error: ' + error.message,
      traceSteps
    });
  }
});

// Get User Orders
app.get('/orders', (req, res) => {
  const userId = req.query.userId || 1;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(userId);

  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  }

  res.json({ success: true, count: orders.length, orders });
});

app.listen(PORT, () => {
  console.log(`[Order Service] Running on http://localhost:${PORT} (DB: ${path.basename(DB_PATH)})`);
});
