// ==========================================
// NovaCommerce Microservices Client Application
// Communicates with API Gateway (Port 8000)
// ==========================================

const API_BASE = '/api';
let currentProducts = [];
let currentCategory = 'All';
let currentSort = 'featured';
let currentDiscountCode = '';
let currentDiscountRate = 0;
let currentCart = { items: [], itemCount: 0, summary: { subtotal: 0, tax: 0, total: 0 } };

// DOM References
const viewShop = document.getElementById('viewShop');
const viewOrders = document.getElementById('viewOrders');
const viewTopology = document.getElementById('viewTopology');
const productsGrid = document.getElementById('productsGrid');
const cartDrawer = document.getElementById('cartDrawer');
const cartItemsList = document.getElementById('cartItemsList');
const cartCount = document.getElementById('cartCount');
const checkoutModal = document.getElementById('checkoutModal');
const orderSuccessModal = document.getElementById('orderSuccessModal');
const toastContainer = document.getElementById('toastContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadProducts();
  loadCart();
  loadTopology();
  loadTraces();

  // Periodic poll of topology health
  setInterval(loadTopology, 8000);
});

function initEventListeners() {
  // Navigation Tabs
  document.getElementById('navShopBtn').addEventListener('click', () => switchView('shop'));
  document.getElementById('navOrdersBtn').addEventListener('click', () => {
    switchView('orders');
    loadOrders();
  });
  document.getElementById('navTopologyBtn').addEventListener('click', () => {
    switchView('topology');
    loadTopology();
    loadTraces();
  });
  document.getElementById('openTopologyFromBanner').addEventListener('click', () => {
    switchView('topology');
    loadTopology();
    loadTraces();
  });

  // Search & Filter
  document.getElementById('searchInput').addEventListener('input', (e) => {
    loadProducts(e.target.value.trim());
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadProducts();
  });

  const categoryPills = document.querySelectorAll('#categoryPills .pill');
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.category;
      loadProducts();
    });
  });

  // Cart Drawer
  document.getElementById('openCartBtn').addEventListener('click', openCart);
  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  document.getElementById('cartBackdrop').addEventListener('click', closeCart);

  // Coupon
  document.getElementById('applyCouponBtn').addEventListener('click', applyCoupon);

  // Checkout Flow
  document.getElementById('proceedToCheckoutBtn').addEventListener('click', openCheckout);
  document.getElementById('closeCheckoutBtn').addEventListener('click', closeCheckout);
  document.getElementById('checkoutBackdrop').addEventListener('click', closeCheckout);
  document.getElementById('cancelCheckoutBtn').addEventListener('click', closeCheckout);
  document.getElementById('checkoutForm').addEventListener('submit', handleCheckoutSubmit);

  // Success Modal
  document.getElementById('successBackdrop').addEventListener('click', closeSuccess);
  document.getElementById('continueShoppingBtn').addEventListener('click', () => {
    closeSuccess();
    switchView('shop');
  });
  document.getElementById('viewMyOrdersBtn').addEventListener('click', () => {
    closeSuccess();
    switchView('orders');
    loadOrders();
  });

  // Traces & Orders Refresh
  document.getElementById('refreshTracesBtn')?.addEventListener('click', () => {
    loadTopology();
    loadTraces();
  });
  document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);
}

// View Switcher
function switchView(viewName) {
  const views = { shop: viewShop, orders: viewOrders, topology: viewTopology };
  const navBtns = {
    shop: document.getElementById('navShopBtn'),
    orders: document.getElementById('navOrdersBtn'),
    topology: document.getElementById('navTopologyBtn')
  };

  Object.keys(views).forEach(v => {
    if (views[v]) views[v].classList.toggle('active', v === viewName);
    if (navBtns[v]) navBtns[v].classList.toggle('active', v === viewName);
  });

  if (viewName === 'orders') loadOrders();
  if (viewName === 'topology') { loadTopology(); loadTraces(); }
  if (viewName === 'shop') loadProducts();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 1. PRODUCT CATALOG (Gateway -> Product Service :8001)
// ==========================================
async function loadProducts(search = '') {
  try {
    let url = `${API_BASE}/products?category=${encodeURIComponent(currentCategory)}&sort=${currentSort}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url, { headers: { 'X-Correlation-ID': `web-${Date.now()}` } });
    const data = await res.json();
    if (data.success) {
      currentProducts = data.data;
      renderProducts(currentProducts);
    }
  } catch (err) {
    showToast('Failed to connect to API Gateway for Products', 'error');
  }
}

function renderProducts(products) {
  if (!products || products.length === 0) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-dim);">
        <p style="font-size: 1.1rem; margin-bottom: 8px;">No matching items found</p>
        <small>Try selecting "All Categories" or adjusting your search keyword.</small>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = products.map(p => `
    <article class="product-card">
      <div class="product-img-wrapper">
        <img src="${p.image}" alt="${p.title}" class="product-img" loading="lazy">
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-content">
        <span class="product-category-tag">${p.category}</span>
        <h3 class="product-title">${p.title}</h3>
        <p class="product-desc">${p.description}</p>
        
        <div class="product-rating">
          <span>★ ${p.rating.toFixed(1)}</span>
          <span class="rating-count">(${p.reviews_count} reviews)</span>
        </div>

        <div class="product-footer">
          <div>
            <div class="product-price">$${p.price.toFixed(2)}</div>
            <span class="stock-indicator">● ${p.stock} in stock (:8001)</span>
          </div>
          <button class="add-cart-btn" onclick="handleAddToCart(${p.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// ==========================================
// 2. CART MANAGEMENT (Gateway -> Order Service :8003)
// ==========================================
async function loadCart() {
  try {
    const res = await fetch(`${API_BASE}/cart?userId=1`);
    const data = await res.json();
    if (data.success) {
      currentCart = data;
      updateCartBadge();
      renderCartDrawer();
    }
  } catch (err) {
    console.error('Failed to load cart', err);
  }
}

async function handleAddToCart(productId) {
  try {
    const res = await fetch(`${API_BASE}/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': `corr-cart-add-${Date.now()}`
      },
      body: JSON.stringify({ userId: 1, productId, quantity: 1 })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Added to Cart via Order Microservice', 'success');
      loadCart();
    } else {
      showToast(data.message || 'Cannot add product', 'error');
    }
  } catch (err) {
    showToast('Failed to contact Order Service via Gateway', 'error');
  }
}

async function updateCartQuantity(cartId, quantity) {
  try {
    const res = await fetch(`${API_BASE}/cart/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId, quantity })
    });
    const data = await res.json();
    if (data.success) {
      loadCart();
    }
  } catch (err) {
    showToast('Failed to update cart', 'error');
  }
}

async function removeCartItem(cartId) {
  try {
    const res = await fetch(`${API_BASE}/cart/${cartId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Item removed from cart', 'info');
      loadCart();
    }
  } catch (err) {
    showToast('Failed to remove item', 'error');
  }
}

function updateCartBadge() {
  cartCount.textContent = currentCart.itemCount || 0;
  document.getElementById('cartHeaderCount').textContent = `${currentCart.itemCount || 0} items &bull; Managed by Order-Service (:8003)`;
}

function renderCartDrawer() {
  const items = currentCart.items || [];
  if (items.length === 0) {
    cartItemsList.innerHTML = `
      <div class="empty-cart-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; color: var(--text-dim);"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <p>Your microservice cart is empty</p>
        <small>Stored autonomously in order_service.db.</small>
      </div>
    `;
    document.getElementById('cartFooter').style.display = 'none';
    return;
  }

  document.getElementById('cartFooter').style.display = 'block';

  cartItemsList.innerHTML = items.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        <div class="cart-item-controls">
          <div class="qty-stepper">
            <button class="qty-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
          </div>
          <button class="remove-item-btn" onclick="removeCartItem(${item.id})">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  // Calculations
  const subtotal = currentCart.summary.subtotal || 0;
  const discount = +(subtotal * currentDiscountRate).toFixed(2);
  const tax = +((subtotal - discount) * 0.08).toFixed(2);
  const total = +(subtotal - discount + tax).toFixed(2);

  document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
  if (discount > 0) {
    document.getElementById('discountLine').style.display = 'flex';
    document.getElementById('summaryDiscount').textContent = `-$${discount.toFixed(2)} (${currentDiscountCode})`;
  } else {
    document.getElementById('discountLine').style.display = 'none';
  }
  document.getElementById('summaryTax').textContent = `$${tax.toFixed(2)}`;
  document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('checkoutTotalValue').textContent = total.toFixed(2);
}

function applyCoupon() {
  const code = document.getElementById('couponInput').value.trim().toUpperCase();
  if (code === 'SAVE10') {
    currentDiscountCode = 'SAVE10';
    currentDiscountRate = 0.10;
    showToast('Applied 10% Discount Code!', 'success');
  } else if (code === 'MICRO20') {
    currentDiscountCode = 'MICRO20';
    currentDiscountRate = 0.20;
    showToast('Applied 20% Microservices Special Code!', 'success');
  } else {
    currentDiscountCode = '';
    currentDiscountRate = 0;
    showToast('Invalid coupon code. Try SAVE10 or MICRO20', 'error');
  }
  renderCartDrawer();
}

function openCart() {
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
}

// ==========================================
// 3. CHECKOUT & DISTRIBUTED SAGA
// ==========================================
function openCheckout() {
  if (!currentCart.items || currentCart.items.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }
  closeCart();
  checkoutModal.classList.add('open');
}

function closeCheckout() {
  checkoutModal.classList.remove('open');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const confirmBtn = document.getElementById('confirmOrderBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Orchestrating Saga Workflow (Svc 8003 & 8001 & 8004)...';

  const correlationId = `saga-tx-${Date.now()}`;
  const payload = {
    userId: 1,
    shippingName: document.getElementById('shippingName').value,
    shippingAddress: document.getElementById('shippingAddress').value,
    shippingCity: document.getElementById('shippingCity').value,
    shippingZip: document.getElementById('shippingZip').value,
    paymentMethod: document.querySelector('input[name="payMethod"]:checked').value,
    discountCode: currentDiscountCode
  };

  try {
    const res = await fetch(`${API_BASE}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeCheckout();
      showOrderSuccess(data.order);
      loadCart();
      loadProducts();
      loadTraces();
      loadTopology();
    } else {
      showToast(data.message || 'Distributed Saga failed', 'error');
    }
  } catch (err) {
    showToast('Distributed transaction error: ' + err.message, 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Confirm Saga Order ($${document.getElementById('checkoutTotalValue').textContent})`;
  }
}

function showOrderSuccess(order) {
  const receiptEl = document.getElementById('successReceiptDetails');
  receiptEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Order Number:</span>
      <strong style="color: #6ee7b7; font-family: var(--font-mono);">${order.orderNumber}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Total Charged:</span>
      <strong style="color: #fff;">$${order.totalAmount.toFixed(2)}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Payment Authorization:</span>
      <span style="color: var(--accent-emerald); font-weight: 600;">APPROVED (:8004)</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Tx Reference:</span>
      <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #cbd5e1;">${order.transactionRef}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Correlation ID:</span>
      <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #38bdf8;">${order.correlationId}</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--text-dim);">Total Network Duration:</span>
      <span style="color: #a7f3d0; font-weight: 600;">${order.totalDurationMs} ms (Multi-Service RPC)</span>
    </div>

    ${order.sagaTraceSteps ? `
      <div class="saga-trace-chips">
        <span style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 2px;">Multi-Service Saga Hop Execution:</span>
        ${order.sagaTraceSteps.map(s => `
          <div class="saga-chip-item">
            <span style="color: #6ee7b7;">${s.service}</span>
            <span style="color: var(--text-muted);">${s.action}</span>
            <span style="color: #38bdf8;">${s.latencyMs ? s.latencyMs + 'ms' : 'Local'}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
  orderSuccessModal.classList.add('open');
}

function closeSuccess() {
  orderSuccessModal.classList.remove('open');
}

// ==========================================
// 4. ORDERS HISTORY
// ==========================================
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders?userId=1`);
    const data = await res.json();
    if (data.success) {
      renderOrders(data.orders);
    }
  } catch (err) {
    console.error('Failed to load orders', err);
  }
}

function renderOrders(orders) {
  const listEl = document.getElementById('ordersList');
  if (!orders || orders.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
        <p style="color: var(--text-dim); margin-bottom: 6px;">No microservice orders placed yet.</p>
        <small style="color: var(--text-muted);">Execute a saga checkout to see records committed to order_service.db.</small>
      </div>
    `;
    return;
  }

  listEl.innerHTML = orders.map(ord => `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <span class="order-number">${ord.order_number}</span>
          <span class="order-date">&bull; Placed on ${new Date(ord.created_at).toLocaleString()}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="order-badge-pill">✓ ${ord.order_status}</span>
          <span style="font-size: 0.75rem; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 4px 8px; border-radius: 4px; font-family: var(--font-mono);">${ord.correlation_id || 'trace-ms'}</span>
        </div>
      </div>

      <div class="order-items-grid">
        ${(ord.items || []).map(item => `
          <div class="order-item-chip">
            <div class="order-item-title">${item.title}</div>
            <div class="order-item-meta">Qty: ${item.quantity} &times; $${item.price.toFixed(2)}</div>
          </div>
        `).join('')}
      </div>

      <div class="order-card-footer">
        <div class="order-tx-info">
          Payment Tx: ${ord.payment_tx_ref || 'N/A'} &bull; Shipping to: ${ord.shipping_city}, ${ord.shipping_zip}
        </div>
        <div class="order-total-sum">$${ord.total_amount.toFixed(2)}</div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// 5. TOPOLOGY & DISTRIBUTED TRACING
// ==========================================
async function loadTopology() {
  try {
    const res = await fetch(`${API_BASE}/gateway/topology`);
    const data = await res.json();

    // Update Gateway Header
    const gwEl = document.getElementById('gwStatus');
    if (gwEl) gwEl.textContent = `● ${data.gateway.status} (${data.gateway.uptimeSeconds}s uptime)`;

    // Render 4 Microservices Cards
    const grid = document.getElementById('servicesGrid');
    if (grid && data.services) {
      grid.innerHTML = data.services.map(svc => `
        <div class="service-card">
          <div class="service-card-top">
            <div class="service-icon-pill">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <span class="status-pill-green">${svc.status}</span>
          </div>

          <h4 class="service-name">${svc.name}</h4>

          <div class="service-meta-line">
            <span>Port</span>
            <strong style="color: #fff; font-family: var(--font-mono);">${svc.port}</strong>
          </div>

          <div class="service-meta-line">
            <span>Dedicated DB</span>
            <span class="service-db-tag">${svc.databaseFile}</span>
          </div>

          <div class="service-meta-line">
            <span>Ping Latency</span>
            <span class="service-latency-pill">${svc.latencyMs} ms</span>
          </div>

          <div class="service-meta-line" style="border-bottom: none;">
            <span>Endpoint</span>
            <small style="color: var(--text-dim); font-family: var(--font-mono);">${svc.url}</small>
          </div>
        </div>
      `).join('');

      const onlineCount = data.services.filter(s => s.status === 'HEALTHY').length;
      const statServicesOnline = document.getElementById('statServicesOnline');
      if (statServicesOnline) statServicesOnline.textContent = `${onlineCount} / ${data.services.length} UP`;
    }
  } catch (err) {
    console.error('Failed to load topology', err);
  }
}

async function loadTraces() {
  try {
    const res = await fetch(`${API_BASE}/gateway/traces`);
    const data = await res.json();
    const tbody = document.getElementById('traceTableBody');

    if (tbody && data.traces) {
      if (data.traces.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 24px;">No distributed traces yet. Perform browsing or checkout to populate traces.</td></tr>`;
      } else {
        tbody.innerHTML = data.traces.map(t => `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 0.72rem;">${new Date(t.timestamp).toLocaleTimeString()}</td>
            <td class="corr-id-tag">${t.correlationId}</td>
            <td><span class="method-tag ${t.method}">${t.method}</span></td>
            <td style="font-family: var(--font-mono); color: #fff;">${t.path}</td>
            <td style="color: #6ee7b7; font-weight: 500;">${t.targetService} (:${t.targetPort})</td>
            <td><span style="color: ${t.status < 400 ? 'var(--accent-emerald)' : 'var(--accent-red)'}; font-weight: 700;">${t.status}</span></td>
            <td style="color: #38bdf8; font-family: var(--font-mono); font-weight: 600;">${t.durationMs} ms</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load traces', err);
  }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
