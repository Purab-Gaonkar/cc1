const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const MONO_DIR = path.join(SCREENSHOTS_DIR, 'monolithic');
const MICRO_DIR = path.join(SCREENSHOTS_DIR, 'microservices');

fs.mkdirSync(MONO_DIR, { recursive: true });
fs.mkdirSync(MICRO_DIR, { recursive: true });

async function run() {
  console.log('Launching Chrome for automated visual captures...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  // ==========================================
  // PART 1: MONOLITHIC APPLICATION (PORT 5000)
  // ==========================================
  console.log('Navigating to Monolithic App (http://localhost:5000)...');
  await page.goto('http://localhost:5000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // 1. Monolith Storefront
  await page.screenshot({ path: path.join(MONO_DIR, '01-monolithic-storefront.png'), fullPage: false });
  console.log('Captured: 01-monolithic-storefront.png');

  // Add items to cart for visual display
  await page.evaluate(() => {
    handleAddToCart(1);
    handleAddToCart(2);
  });
  await new Promise(r => setTimeout(r, 1000));

  // 2. Open Cart Drawer
  await page.evaluate(() => openCart());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(MONO_DIR, '02-monolithic-cart-drawer.png'), fullPage: false });
  console.log('Captured: 02-monolithic-cart-drawer.png');

  // 3. Open Checkout Modal
  await page.evaluate(() => openCheckout());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(MONO_DIR, '03-monolithic-checkout-modal.png'), fullPage: false });
  console.log('Captured: 03-monolithic-checkout-modal.png');

  // Close Checkout Modal & Close Cart
  await page.evaluate(() => {
    closeCheckout();
    closeCart();
  });
  await new Promise(r => setTimeout(r, 500));

  // 4. Switch to Diagnostics / Architecture Inspector
  await page.evaluate(() => switchView('inspector'));
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(MONO_DIR, '04-monolithic-system-diagnostics.png'), fullPage: false });
  console.log('Captured: 04-monolithic-system-diagnostics.png');

  // 5. Switch to Orders History
  await page.evaluate(() => switchView('orders'));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(MONO_DIR, '05-monolithic-order-history.png'), fullPage: false });
  console.log('Captured: 05-monolithic-order-history.png');

  // ==========================================
  // PART 2: MICROSERVICES APPLICATION (PORT 8000)
  // ==========================================
  console.log('Navigating to Microservices App (http://localhost:8000)...');
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // 1. Microservices Storefront
  await page.screenshot({ path: path.join(MICRO_DIR, '01-microservices-storefront.png'), fullPage: false });
  console.log('Captured: 01-microservices-storefront.png');

  // Add items to cart for visual display
  await page.evaluate(() => {
    handleAddToCart(1);
    handleAddToCart(3);
  });
  await new Promise(r => setTimeout(r, 1000));

  // 2. Open Cart Drawer
  await page.evaluate(() => openCart());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(MICRO_DIR, '02-microservices-cart-drawer.png'), fullPage: false });
  console.log('Captured: 02-microservices-cart-drawer.png');

  // 3. Open Checkout Modal
  await page.evaluate(() => openCheckout());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(MICRO_DIR, '03-microservices-saga-checkout.png'), fullPage: false });
  console.log('Captured: 03-microservices-saga-checkout.png');

  // Close Checkout Modal & Close Cart
  await page.evaluate(() => {
    closeCheckout();
    closeCart();
  });
  await new Promise(r => setTimeout(r, 500));

  // 4. Switch to Service Mesh Topology & Distributed Tracing
  await page.evaluate(() => switchView('topology'));
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(MICRO_DIR, '04-microservices-topology-mesh.png'), fullPage: false });
  console.log('Captured: 04-microservices-topology-mesh.png');

  // 5. Switch to Orders History
  await page.evaluate(() => switchView('orders'));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(MICRO_DIR, '05-microservices-order-ledger.png'), fullPage: false });
  console.log('Captured: 05-microservices-order-ledger.png');

  await browser.close();
  console.log('All 10 screenshots captured successfully!');
}

run().catch(err => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
