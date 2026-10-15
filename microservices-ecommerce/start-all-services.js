const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Product Service', file: 'product-service/server.js', port: 8001 },
  { name: 'User Service   ', file: 'user-service/server.js', port: 8002 },
  { name: 'Payment Service', file: 'payment-service/server.js', port: 8004 },
  { name: 'Order Service  ', file: 'order-service/server.js', port: 8003 },
  { name: 'API Gateway    ', file: 'api-gateway/server.js', port: 8000 }
];

const children = [];

console.log('=======================================================');
console.log('🚀 STARTING ALL 5 MICROSERVICES...');
console.log('=======================================================');

services.forEach((s) => {
  const fullPath = path.join(__dirname, s.file);
  const child = spawn(process.execPath, [fullPath], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, PORT: s.port }
  });

  child.on('error', (err) => {
    console.error(`[${s.name}] Failed to start:`, err);
  });

  child.on('exit', (code, signal) => {
    console.log(`[${s.name}] Exited with code ${code} / signal ${signal}`);
  });

  children.push(child);
});

process.on('SIGINT', () => {
  console.log('\nStopping all microservices...');
  children.forEach((c) => c.kill());
  process.exit(0);
});

process.on('SIGTERM', () => {
  children.forEach((c) => c.kill());
  process.exit(0);
});
