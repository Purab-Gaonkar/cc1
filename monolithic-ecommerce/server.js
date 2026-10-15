const express = require('express');
const cors = require('cors');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'monolith_ecommerce.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Monolithic Single Shared SQLite Database
const db = new DatabaseSync(DB_PATH);

// Initialize Database Schema & Seed Data
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      rating REAL DEFAULT 4.5,
      reviews_count INTEGER DEFAULT 120,
      image TEXT NOT NULL,
      badge TEXT,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
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
      order_status TEXT DEFAULT 'Processing',
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

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      transaction_ref TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monolith_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      duration_ms REAL NOT NULL,
      memory_rss_mb REAL NOT NULL,
      internal_modules_invoked TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default user if not exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertUser.run('alex', 'alex.turner@cloudtech.com', 'password123', 'Alex Turner', 'customer');
    insertUser.run('admin', 'admin@aurastore.com', 'adminpass', 'System Administrator', 'admin');
  }

  // Seed catalog products if not exists
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (title, category, price, stock, rating, reviews_count, image, badge, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedProducts = [
      {
        title: 'Zenith Pro 16" Creator Laptop',
        category: 'Laptops',
        price: 1899.99,
        stock: 14,
        rating: 4.9,
        reviews_count: 248,
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=700&q=80',
        badge: 'Bestseller',
        description: 'M3 Max powerhouse with Liquid Retina XDR display, 36GB unified memory, and 18-hour battery endurance.'
      },
      {
        title: 'Nova ANC Wireless Headphones',
        category: 'Audio',
        price: 299.99,
        stock: 42,
        rating: 4.8,
        reviews_count: 512,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80',
        badge: 'Top Rated',
        description: 'Spatial audio with custom 40mm beryllium drivers, active noise cancellation, and transparency mode.'
      },
      {
        title: 'Aura Smartphone 15 Ultra 512GB',
        category: 'Smartphones',
        price: 1199.00,
        stock: 25,
        rating: 4.7,
        reviews_count: 380,
        image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=700&q=80',
        badge: 'New Release',
        description: 'Titanium aerospace enclosure, 200MP periscope zoom lens, and ultra-bright 144Hz AMOLED display.'
      },
      {
        title: 'Quantum Mechanical Keyboard RGB',
        category: 'Accessories',
        price: 149.50,
        stock: 58,
        rating: 4.6,
        reviews_count: 194,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80',
        badge: 'Sale 15% OFF',
        description: 'Hot-swappable linear yellow switches, PBT dye-sub keycaps, and customizable per-key dynamic lighting.'
      },
      {
        title: 'UltraPulse Pro Smartwatch Series 9',
        category: 'Wearables',
        price: 399.00,
        stock: 31,
        rating: 4.8,
        reviews_count: 420,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
        badge: 'Featured',
        description: 'ECG heart rate sensor, blood oxygen tracking, sapphire crystal glass, and 100m water resistance.'
      },
      {
        title: 'Eclipse 4K HDR 165Hz Gaming Monitor',
        category: 'Accessories',
        price: 649.99,
        stock: 9,
        rating: 4.9,
        reviews_count: 142,
        badge: 'Limited Stock',
        image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=700&q=80',
        description: 'Quantum Dot IPS panel, 1ms response time, NVIDIA G-Sync Ultimate compatibility, and ergonomic arm stand.'
      },
      {
        title: 'CyberSound Studio Soundbar Dolby Atmos',
        category: 'Audio',
        price: 449.00,
        stock: 19,
        rating: 4.7,
        reviews_count: 88,
        badge: 'Popular',
        image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=700&q=80',
        description: 'True 5.1.2 surround sound immersion with wireless subwoofer and eARC high-fidelity audio pass-through.'
      },
      {
        title: 'Vanguard Ergonomic Gaming Chair',
        category: 'Accessories',
        price: 329.00,
        stock: 15,
        rating: 4.6,
        reviews_count: 167,
        badge: 'Staff Pick',
        image: 'https://images.unsplash.com/photo-1580481077195-c3c3a9f02932?auto=format&fit=crop&w=700&q=80',
        description: 'Multi-tilt lock mechanism, breathable mesh lumbar contour, 4D armrests, and class-4 heavy-duty gas lift.'
      }
    ];

    for (const p of seedProducts) {
      insertProduct.run(p.title, p.category, p.price, p.stock, p.rating, p.reviews_count, p.image, p.badge, p.description);
    }
  }
}

initDatabase();

// In-Process Performance & Monolith Log Middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const duration = +(performance.now() - start).toFixed(2);
    const memUsage = +(process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    
    // Log internal calls if it is an API route
    if (req.path.startsWith('/api') && !req.path.includes('/monolith/diagnostics')) {
      try {
        let modules = ['RoutingLayer', 'ExpressKernel'];
        if (req.path.includes('/products')) modules.push('ProductCatalogController', 'MonolithSQLiteEngine');
        if (req.path.includes('/cart')) modules.push('CartController', 'SessionModule', 'MonolithSQLiteEngine');
        if (req.path.includes('/checkout')) modules.push('OrderOrchestrator', 'InventoryManager', 'PaymentGatewaySim', 'AtomicTransactionManager');
        if (req.path.includes('/auth')) modules.push('UserAuthController', 'SecurityModule');

        const insertLog = db.prepare(`
          INSERT INTO monolith_logs (endpoint, method, duration_ms, memory_rss_mb, internal_modules_invoked)
          VALUES (?, ?, ?, ?, ?)
        `);
        insertLog.run(req.path, req.method, duration, memUsage, modules.join(' -> '));
      } catch (err) {
        // ignore logging error
      }
    }
  });
  next();
});

// ==========================================
// 1. SYSTEM HEALTH & ARCHITECTURE INFO
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    architecture: 'MONOLITHIC',
    processId: process.pid,
    serverPort: PORT,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      type: 'SQLite Embedded (Single Shared Database)',
      dbFile: path.basename(DB_PATH),
      status: 'CONNECTED_DIRECT'
    },
    characteristics: {
      deployment: 'Single unified deployment unit',
      communication: 'Direct in-memory method invocations (Zero network latency overhead)',
      dataConsistency: 'Strong ACID via shared database transactions',
      scaling: 'Vertical or full-copy horizontal scaling',
      failureRadius: 'High (A fault in one module can crash the entire monolith)'
    }
  });
});

// ==========================================
// 2. PRODUCT CATALOG MODULE
// ==========================================
app.get('/api/products', (req, res) => {
  const { category, search, sort } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (sort === 'price-low') query += ' ORDER BY price ASC';
  else if (sort === 'price-high') query += ' ORDER BY price DESC';
  else if (sort === 'rating') query += ' ORDER BY rating DESC';
  else query += ' ORDER BY id ASC';

  const products = db.prepare(query).all(...params);
  res.json({ success: true, count: products.length, data: products });
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// ==========================================
// 3. USER AUTHENTICATION MODULE
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?').get(username, username, password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Try: alex / password123' });
  }

  res.json({
    success: true,
    message: 'Monolithic In-Memory Session Established',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role
    }
  });
});

app.get('/api/auth/profile/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
});

// ==========================================
// 4. SHOPPING CART MODULE
// ==========================================
app.get('/api/cart', (req, res) => {
  const userId = req.query.userId || 1;
  const items = db.prepare(`
    SELECT c.id as cart_id, c.quantity, p.id as product_id, p.title, p.price, p.image, p.stock, p.category
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(userId);

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = +(subtotal * 0.08).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  res.json({
    success: true,
    items,
    itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
    summary: { subtotal: +subtotal.toFixed(2), tax, total }
  });
});

app.post('/api/cart/add', (req, res) => {
  const { userId = 1, productId, quantity = 1 } = req.body;

  const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const existing = db.prepare('SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?').get(userId, productId);

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > product.stock) {
      return res.status(400).json({ success: false, message: 'Insufficient stock available' });
    }
    db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    if (quantity > product.stock) {
      return res.status(400).json({ success: false, message: 'Insufficient stock available' });
    }
    db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, productId, quantity);
  }

  res.json({ success: true, message: 'Added to cart successfully' });
});

app.post('/api/cart/update', (req, res) => {
  const { cartId, quantity } = req.body;
  if (quantity <= 0) {
    db.prepare('DELETE FROM cart WHERE id = ?').run(cartId);
  } else {
    db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(quantity, cartId);
  }
  res.json({ success: true, message: 'Cart updated' });
});

app.delete('/api/cart/remove/:cartId', (req, res) => {
  db.prepare('DELETE FROM cart WHERE id = ?').run(req.params.cartId);
  res.json({ success: true, message: 'Item removed from cart' });
});

app.post('/api/cart/clear', (req, res) => {
  const userId = req.body.userId || 1;
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(userId);
  res.json({ success: true, message: 'Cart cleared' });
});

// ==========================================
// 5. MONOLITHIC CHECKOUT & ORDER PROCESSING
// (All handled in a single synchronous in-memory transaction!)
// ==========================================
app.post('/api/checkout', (req, res) => {
  const {
    userId = 1,
    shippingName,
    shippingAddress,
    shippingCity,
    shippingZip,
    paymentMethod = 'Credit Card',
    discountCode
  } = req.body;

  // 1. Fetch Cart Items
  const cartItems = db.prepare(`
    SELECT c.product_id, c.quantity, p.title, p.price, p.stock
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(userId);

  if (!cartItems.length) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  // 2. Validate Inventory
  for (const item of cartItems) {
    if (item.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${item.title}". Only ${item.stock} left.`
      });
    }
  }

  // 3. Calculate Financials
  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  let discount = 0;
  if (discountCode === 'SAVE10') discount = subtotal * 0.10;
  else if (discountCode === 'MONOLITH20') discount = subtotal * 0.20;
  const tax = (subtotal - discount) * 0.08;
  const totalAmount = +(subtotal - discount + tax).toFixed(2);

  // 4. Execute Atomic Monolithic Transaction
  try {
    db.exec('BEGIN TRANSACTION');

    const orderNumber = 'MONO-' + Math.floor(100000 + Math.random() * 900000);

    // Insert Order Record
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, subtotal, discount, total_amount,
        shipping_name, shipping_address, shipping_city, shipping_zip,
        payment_method, payment_status, order_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run(
      orderNumber, userId, +subtotal.toFixed(2), +discount.toFixed(2), totalAmount,
      shippingName || 'Alex Turner', shippingAddress || '742 Evergreen Terrace',
      shippingCity || 'Springfield', shippingZip || '97477',
      paymentMethod, 'PAID_SUCCESS', 'Confirmed'
    );

    const order = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber);

    // Insert Order Items and Decrement Product Stock
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, title, price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      insertItem.run(order.id, item.product_id, item.title, item.price, item.quantity);
      updateStock.run(item.quantity, item.product_id);
    }

    // Insert Monolithic Payment Record
    const txRef = 'TX-MONO-' + Date.now();
    db.prepare(`
      INSERT INTO payments (order_id, amount, method, status, transaction_ref)
      VALUES (?, ?, ?, ?, ?)
    `).run(order.id, totalAmount, paymentMethod, 'COMPLETED', txRef);

    // Clear User Cart
    db.prepare('DELETE FROM cart WHERE user_id = ?').run(userId);

    db.exec('COMMIT');

    res.json({
      success: true,
      message: 'Order placed successfully via in-process Monolithic Transaction!',
      order: {
        orderId: order.id,
        orderNumber,
        totalAmount,
        paymentStatus: 'PAID_SUCCESS',
        transactionRef: txRef,
        itemsCount: cartItems.length
      }
    });

  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Monolithic Checkout Error:', error);
    res.status(500).json({ success: false, message: 'Checkout transaction failed: ' + error.message });
  }
});

// ==========================================
// 6. ORDERS HISTORY MODULE
// ==========================================
app.get('/api/orders', (req, res) => {
  const userId = req.query.userId || 1;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(userId);

  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    order.payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);
  }

  res.json({ success: true, count: orders.length, orders });
});

// ==========================================
// 7. MONOLITHIC ARCHITECTURAL DIAGNOSTICS
// ==========================================
app.get('/api/monolith/diagnostics', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const cartCount = db.prepare('SELECT COUNT(*) as c FROM cart').get().c;
  const paymentCount = db.prepare('SELECT COUNT(*) as c FROM payments').get().c;
  const logCount = db.prepare('SELECT COUNT(*) as c FROM monolith_logs').get().c;

  const recentLogs = db.prepare(`
    SELECT * FROM monolith_logs ORDER BY id DESC LIMIT 10
  `).all();

  const memoryUsage = process.memoryUsage();

  res.json({
    architectureType: 'Monolithic (Single Shared Deployment & Database)',
    serverInfo: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      port: PORT,
      platform: process.platform,
      memory: {
        rssMB: +(memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapTotalMB: +(memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        heapUsedMB: +(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
      }
    },
    monolithicDatabase: {
      engine: 'SQLite3 Embedded Database Engine',
      dbFile: 'monolith_ecommerce.db',
      schemaModel: 'Shared Single Schema (ACID Transactional Coupling)',
      tableStats: {
        users: userCount,
        products: productCount,
        orders: orderCount,
        cartItems: cartCount,
        payments: paymentCount,
        traceLogs: logCount
      }
    },
    internalComponents: [
      { name: 'Storefront Web Server', role: 'Serves static HTML/CSS/JS and renders SPA assets' },
      { name: 'Product Catalog Module', role: 'Queries product inventories from monolithic database' },
      { name: 'User Authentication Module', role: 'Manages user sessions in-memory & credentials' },
      { name: 'Cart Manager', role: 'Updates user cart state directly in shared tables' },
      { name: 'Order Processing Orchestrator', role: 'Executes atomic ACID transactions across products/orders/payments' },
      { name: 'Payment Simulator', role: 'Directly validates and records transaction ledger in-process' }
    ],
    tradeoffs: {
      advantages: [
        'Zero network latency between modules (direct RAM function execution)',
        'Unified ACID transactions across business domains without two-phase commit overhead',
        'Simple single-repo development, straightforward debugging, and single-artifact deployment',
        'No service discovery, complex distributed tracing, or API gateway configuration required'
      ],
      disadvantages: [
        'Single Point of Failure: A memory leak or unhandled exception in one module crashes the whole server',
        'Tightly coupled codebase makes independent scaling of high-traffic features impossible',
        'Tech stack lock-in: entire application must share the same runtime and dependencies',
        'Large blast radius for releases: small bug fix in payments requires redeploying the catalog'
      ]
    },
    recentExecutionTraces: recentLogs
  });
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏛️  MONOLITHIC E-COMMERCE SERVER RUNNING`);
  console.log(`🚀 Port: http://localhost:${PORT}`);
  console.log(`💾 Database: SQLite [monolith_ecommerce.db] (Single Shared DB)`);
  console.log(`📦 Architecture: Monolithic (Unified Express Process)`);
  console.log(`=======================================================`);
});
