const express = require('express');
const cors = require('cors');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 8001;
const SERVICE_NAME = 'Product Catalog Microservice';
const DB_PATH = path.join(__dirname, 'product_service.db');

app.use(cors());
app.use(express.json());

// Isolated Database per Service
const db = new DatabaseSync(DB_PATH);

db.exec(`
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
`);

// Seed Products if table is empty
const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO products (title, category, price, stock, rating, reviews_count, image, badge, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seed = [
    {
      title: 'Zenith Pro 16" Creator Laptop',
      category: 'Laptops',
      price: 1899.99,
      stock: 12,
      rating: 4.9,
      reviews_count: 248,
      image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=700&q=80',
      badge: 'Microservice Synced',
      description: 'M3 Max powerhouse with Liquid Retina XDR display, 36GB unified memory, and 18-hour battery endurance.'
    },
    {
      title: 'Nova ANC Wireless Headphones',
      category: 'Audio',
      price: 299.99,
      stock: 38,
      rating: 4.8,
      reviews_count: 512,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80',
      badge: 'Top Seller',
      description: 'Spatial audio with custom 40mm beryllium drivers, active noise cancellation, and transparency mode.'
    },
    {
      title: 'Aura Smartphone 15 Ultra 512GB',
      category: 'Smartphones',
      price: 1199.00,
      stock: 22,
      rating: 4.7,
      reviews_count: 380,
      image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=700&q=80',
      badge: 'Flagship',
      description: 'Titanium aerospace enclosure, 200MP periscope zoom lens, and ultra-bright 144Hz AMOLED display.'
    },
    {
      title: 'Quantum Mechanical Keyboard RGB',
      category: 'Accessories',
      price: 149.50,
      stock: 45,
      rating: 4.6,
      reviews_count: 194,
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80',
      badge: 'Sale',
      description: 'Hot-swappable linear yellow switches, PBT dye-sub keycaps, and customizable per-key dynamic lighting.'
    },
    {
      title: 'UltraPulse Pro Smartwatch Series 9',
      category: 'Wearables',
      price: 399.00,
      stock: 28,
      rating: 4.8,
      reviews_count: 420,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
      badge: 'Connected',
      description: 'ECG heart rate sensor, blood oxygen tracking, sapphire crystal glass, and 100m water resistance.'
    },
    {
      title: 'Eclipse 4K HDR 165Hz Gaming Monitor',
      category: 'Accessories',
      price: 649.99,
      stock: 8,
      rating: 4.9,
      reviews_count: 142,
      image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=700&q=80',
      badge: 'Pro Tier',
      description: 'Quantum Dot IPS panel, 1ms response time, NVIDIA G-Sync Ultimate compatibility, and ergonomic arm stand.'
    },
    {
      title: 'CyberSound Studio Soundbar Dolby Atmos',
      category: 'Audio',
      price: 449.00,
      stock: 16,
      rating: 4.7,
      reviews_count: 88,
      image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=700&q=80',
      badge: 'Dolby Atmos',
      description: 'True 5.1.2 surround sound immersion with wireless subwoofer and eARC high-fidelity audio pass-through.'
    },
    {
      title: 'Vanguard Ergonomic Gaming Chair',
      category: 'Accessories',
      price: 329.00,
      stock: 14,
      rating: 4.6,
      reviews_count: 167,
      image: 'https://images.unsplash.com/photo-1580481077195-c3c3a9f02932?auto=format&fit=crop&w=700&q=80',
      badge: 'Ergonomic',
      description: 'Multi-tilt lock mechanism, breathable mesh lumbar contour, 4D armrests, and class-4 heavy-duty gas lift.'
    }
  ];

  for (const item of seed) {
    insert.run(item.title, item.category, item.price, item.stock, item.rating, item.reviews_count, item.image, item.badge, item.description);
  }
}

// Request telemetry logger with correlation ID
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'trace-local';
  res.setHeader('X-Served-By', `${SERVICE_NAME} on Port ${PORT}`);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Health Endpoint
app.get('/health', (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  res.json({
    service: SERVICE_NAME,
    status: 'UP',
    port: PORT,
    database: {
      engine: 'Isolated SQLite per Service',
      file: path.basename(DB_PATH),
      records: productCount
    },
    uptime: Math.floor(process.uptime())
  });
});

// List Products
app.get('/products', (req, res) => {
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

// Get Single Product
app.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: product });
});

// Update Product Stock (Invoked by Order Microservice)
app.put('/products/:id/stock', (req, res) => {
  const { deductQuantity } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (product.stock < deductQuantity) {
    return res.status(400).json({ success: false, message: `Insufficient stock for product ${product.title}` });
  }

  db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(deductQuantity, req.params.id);
  const updated = db.prepare('SELECT id, title, stock FROM products WHERE id = ?').get(req.params.id);

  res.json({
    success: true,
    message: 'Stock decremented successfully in Product Microservice Database',
    product: updated
  });
});

app.listen(PORT, () => {
  console.log(`[Product Service] Running on http://localhost:${PORT} (DB: ${path.basename(DB_PATH)})`);
});
