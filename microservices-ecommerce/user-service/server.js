const express = require('express');
const cors = require('cors');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 8002;
const SERVICE_NAME = 'User & Auth Microservice';
const DB_PATH = path.join(__dirname, 'user_service.db');

app.use(cors());
app.use(express.json());

// Isolated Database per Service
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default users if empty
const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO users (username, email, password, full_name, role, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run('alex', 'alex.turner@cloudtech.com', 'password123', 'Alex Turner', 'customer', '742 Evergreen Terrace, Springfield');
  insert.run('admin', 'admin@novacommerce.com', 'adminpass', 'Cloud Lead Administrator', 'admin', '100 Silicon Way, Tech City');
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
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({
    service: SERVICE_NAME,
    status: 'UP',
    port: PORT,
    database: {
      engine: 'Isolated SQLite per Service',
      file: path.basename(DB_PATH),
      records: userCount
    },
    uptime: Math.floor(process.uptime())
  });
});

// Login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?').get(username, username, password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Try: alex / password123' });
  }

  // Simulated JWT / microservice token
  const token = 'm_jwt_' + Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64');

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      address: user.address
    }
  });
});

// Get User Profile
app.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, email, full_name, role, address, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found in User Microservice DB' });
  res.json({ success: true, user });
});

app.listen(PORT, () => {
  console.log(`[User Service] Running on http://localhost:${PORT} (DB: ${path.basename(DB_PATH)})`);
});
