const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Upstream Microservice URLs
const SERVICES = {
  product: { name: 'Product Catalog Service', url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:8001', port: 8001, db: 'product_service.db' },
  user: { name: 'User & Auth Service', url: process.env.USER_SERVICE_URL || 'http://localhost:8002', port: 8002, db: 'user_service.db' },
  order: { name: 'Order & Cart Service', url: process.env.ORDER_SERVICE_URL || 'http://localhost:8003', port: 8003, db: 'order_service.db' },
  payment: { name: 'Payment Processing Service', url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:8004', port: 8004, db: 'payment_service.db' }
};

// In-Memory Rolling Distributed Trace Buffer
const traceBuffer = [];
const MAX_TRACES = 60;

app.use(cors());
app.use(express.json());

// Serve Microservices Frontend
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Correlation ID & Telemetry Middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `trace-ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  req.correlationId = correlationId;
  res.setHeader('X-Gateway-Node', `API-Gateway-Core:${PORT}`);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Proxy Helper Function
async function proxyRequest(targetBaseUrl, targetPath, req, res, serviceKey) {
  const targetUrl = `${targetBaseUrl}${targetPath}`;
  const start = performance.now();

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': req.correlationId,
        'X-Forwarded-For': req.ip || '127.0.0.1'
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const duration = +(performance.now() - start).toFixed(2);
    const data = await response.json();

    // Record Trace
    recordTrace({
      correlationId: req.correlationId,
      path: req.originalUrl,
      targetService: SERVICES[serviceKey].name,
      targetPort: SERVICES[serviceKey].port,
      method: req.method,
      status: response.status,
      durationMs: duration,
      timestamp: new Date().toISOString()
    });

    res.status(response.status).json(data);
  } catch (error) {
    const duration = +(performance.now() - start).toFixed(2);
    recordTrace({
      correlationId: req.correlationId,
      path: req.originalUrl,
      targetService: SERVICES[serviceKey].name,
      targetPort: SERVICES[serviceKey].port,
      method: req.method,
      status: 503,
      durationMs: duration,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    res.status(503).json({
      success: false,
      message: `Gateway Error: Upstream service "${SERVICES[serviceKey].name}" unavailable on port ${SERVICES[serviceKey].port}`,
      error: error.message
    });
  }
}

function recordTrace(trace) {
  traceBuffer.unshift(trace);
  if (traceBuffer.length > MAX_TRACES) traceBuffer.pop();
}

// ==========================================
// 1. API GATEWAY TOPOLOGY & HEALTH REGISTRY
// ==========================================
app.get('/api/gateway/topology', async (req, res) => {
  const serviceKeys = Object.keys(SERVICES);
  const healthResults = await Promise.all(
    serviceKeys.map(async (key) => {
      const s = SERVICES[key];
      const start = performance.now();
      try {
        const resp = await fetch(`${s.url}/health`, { signal: AbortSignal.timeout(1800) });
        const latency = +(performance.now() - start).toFixed(1);
        if (resp.ok) {
          const body = await resp.json();
          return {
            key,
            name: s.name,
            url: s.url,
            port: s.port,
            databaseFile: s.db,
            status: 'HEALTHY',
            latencyMs: latency,
            details: body
          };
        } else {
          return {
            key,
            name: s.name,
            url: s.url,
            port: s.port,
            databaseFile: s.db,
            status: 'DEGRADED',
            latencyMs: latency
          };
        }
      } catch (err) {
        return {
          key,
          name: s.name,
          url: s.url,
          port: s.port,
          databaseFile: s.db,
          status: 'OFFLINE',
          latencyMs: +(performance.now() - start).toFixed(1),
          error: err.message
        };
      }
    })
  );

  res.json({
    gateway: {
      status: 'ONLINE',
      port: PORT,
      architecture: 'MICROSERVICES_DECENTRALIZED',
      routingPattern: 'API Gateway Reverse Proxy & Circuit Observation',
      activeTraceCount: traceBuffer.length,
      uptimeSeconds: Math.floor(process.uptime())
    },
    services: healthResults
  });
});

// Distributed Traces Endpoint
app.get('/api/gateway/traces', (req, res) => {
  res.json({
    success: true,
    count: traceBuffer.length,
    traces: traceBuffer
  });
});

// ==========================================
// 2. REVERSE PROXY ROUTING RULES
// ==========================================

// Route to Product Microservice (:8001)
app.all('/api/products*', (req, res) => {
  const subPath = req.originalUrl.replace('/api', '');
  proxyRequest(SERVICES.product.url, subPath, req, res, 'product');
});

// Route to User & Auth Microservice (:8002)
app.all('/api/auth*', (req, res) => {
  const subPath = req.originalUrl.replace('/api', '');
  proxyRequest(SERVICES.user.url, subPath, req, res, 'user');
});

app.all('/api/users*', (req, res) => {
  const subPath = req.originalUrl.replace('/api', '');
  proxyRequest(SERVICES.user.url, subPath, req, res, 'user');
});

// Route to Order & Cart Microservice (:8003)
app.all('/api/cart*', (req, res) => {
  const subPath = req.originalUrl.replace('/api', '');
  proxyRequest(SERVICES.order.url, subPath, req, res, 'order');
});

app.all('/api/orders*', (req, res) => {
  const subPath = req.originalUrl.replace('/api', '');
  proxyRequest(SERVICES.order.url, subPath, req, res, 'order');
});

// Route to Payment Microservice (:8004)
app.all('/api/payments*', (req, res) => {
  const subPath = req.originalUrl.replace('/api', '');
  proxyRequest(SERVICES.payment.url, subPath, req, res, 'payment');
});

// Fallback to Frontend Index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

// Start API Gateway
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌐 API GATEWAY RUNNING FOR MICROSERVICES ARCHITECTURE`);
  console.log(`🚀 Port: http://localhost:${PORT}`);
  console.log(`📡 Product Service:  http://localhost:8001 (Port 8001)`);
  console.log(`📡 User Service:     http://localhost:8002 (Port 8002)`);
  console.log(`📡 Order Service:    http://localhost:8003 (Port 8003)`);
  console.log(`📡 Payment Service:  http://localhost:8004 (Port 8004)`);
  console.log(`=======================================================`);
});
