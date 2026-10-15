// ==========================================
// AuraStore Monolithic Application Client
// Unified SPA connected to Port 5000 Express Server
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
const viewInspector = document.getElementById('viewInspector');
const productsGrid = document.getElementById('productsGrid');
const cartDrawer = document.getElementById('cartDrawer');
const cartItemsList = document.getElementById('cartItemsList');
const cartCount = document.getElementById('cartCount');
const checkoutModal = document.getElementById('checkoutModal');
const orderSuccessModal = document.getElementById('orderSuccessModal');
const toastContainer = document.getElementById('toastContainer');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadProducts();
  loadCart();
  loadDiagnostics();
});

function initEventListeners() {
  // Navigation Tabs
  document.getElementById('navShopBtn').addEventListener('click', () => switchView('shop'));
  document.getElementById('navOrdersBtn').addEventListener('click', () => {
    switchView('orders');
    loadOrders();
  });
  document.getElementById('navInspectorBtn').addEventListener('click', () => {
    switchView('inspector');
    loadDiagnostics();
  });
  document.getElementById('openArchInspectorFromBanner').addEventListener('click', () => {
    switchView('inspector');
    loadDiagnostics();
  });

  // Search & Category Filters
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

  // Diagnostics & Orders Refresh
  document.getElementById('refreshTracesBtn')?.addEventListener('click', loadDiagnostics);
  document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);
}

// ==========================================
// VIEW SWITCHER
// ==========================================
function switchView(viewName) {
  const views = { shop: viewShop, orders: viewOrders, inspector: viewInspector };
  const navBtns = {
    shop: document.getElementById('navShopBtn'),
    orders: document.getElementById('navOrdersBtn'),
    inspector: document.getElementById('navInspectorBtn')
  };

  Object.keys(views).forEach(v => {
    if (views[v]) views[v].classList.toggle('active', v === viewName);
    if (navBtns[v]) navBtns[v].classList.toggle('active', v === viewName);
  });

  if (viewName === 'orders') loadOrders();
  if (viewName === 'inspector') loadDiagnostics();
  if (viewName === 'shop') loadProducts();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// PRODUCT CATALOG
// ==========================================
async function loadProducts(search = '') {
  try {
    let url = `${API_BASE}/products?category=${encodeURIComponent(currentCategory)}&sort=${currentSort}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      currentProducts = data.data;
      renderProducts(currentProducts);
    }
  } catch (err) {
    showToast('Failed to connect to monolithic catalog service', 'error');
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
            <span class="stock-indicator">● ${p.stock} in stock</span>
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
// CART MANAGEMENT
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 1, productId, quantity: 1 })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Added to cart (Monolithic DB updated)', 'success');
      loadCart();
    } else {
      showToast(data.message || 'Cannot add product', 'error');
    }
  } catch (err) {
    showToast('Failed to add to cart', 'error');
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
    const res = await fetch(`${API_BASE}/cart/remove/${cartId}`, { method: 'DELETE' });
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
  document.getElementById('cartHeaderCount').textContent = `${currentCart.itemCount || 0} items`;
}

function renderCartDrawer() {
  const items = currentCart.items || [];
  if (items.length === 0) {
    cartItemsList.innerHTML = `
      <div class="empty-cart-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; color: var(--text-dim);"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <p>Your cart is empty</p>
        <small>Explore our catalog to add products.</small>
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
            <button class="qty-btn" onclick="updateCartQuantity(${item.cart_id}, ${item.quantity - 1})">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQuantity(${item.cart_id}, ${item.quantity + 1})">+</button>
          </div>
          <button class="remove-item-btn" onclick="removeCartItem(${item.cart_id})">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  // Calculate pricing breakdown
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
  } else if (code === 'MONOLITH20') {
    currentDiscountCode = 'MONOLITH20';
    currentDiscountRate = 0.20;
    showToast('Applied 20% Monolith Special Code!', 'success');
  } else {
    currentDiscountCode = '';
    currentDiscountRate = 0;
    showToast('Invalid coupon code. Try SAVE10 or MONOLITH20', 'error');
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
// CHECKOUT & ATOMIC TRANSACTION
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
  confirmBtn.textContent = 'Executing Monolithic Transaction...';

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
    const res = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeCheckout();
      showOrderSuccess(data.order);
      loadCart();
      loadProducts(); // refresh stock numbers
      loadDiagnostics(); // refresh diagnostic trace logs
    } else {
      showToast(data.message || 'Transaction failed', 'error');
    }
  } catch (err) {
    showToast('Checkout transaction failed', 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Confirm & Place Order ($${document.getElementById('checkoutTotalValue').textContent})`;
  }
}

function showOrderSuccess(order) {
  const receiptEl = document.getElementById('successReceiptDetails');
  receiptEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Order Number:</span>
      <strong style="color: #c7d2fe; font-family: monospace;">${order.orderNumber}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Total Charged:</span>
      <strong style="color: #fff;">$${order.totalAmount.toFixed(2)}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Payment Status:</span>
      <span style="color: var(--accent-green); font-weight: 600;">${order.paymentStatus}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">Transaction Ref:</span>
      <span style="font-family: monospace; font-size: 0.75rem; color: #cbd5e1;">${order.transactionRef}</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--text-dim);">Execution Scope:</span>
      <span style="color: #818cf8; font-weight: 500;">In-Memory ACID Transaction</span>
    </div>
  `;
  orderSuccessModal.classList.add('open');
}

function closeSuccess() {
  orderSuccessModal.classList.remove('open');
}

// ==========================================
// ORDERS HISTORY
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
        <p style="color: var(--text-dim); margin-bottom: 6px;">No orders placed yet.</p>
        <small style="color: var(--text-muted);">Complete a checkout transaction to see your receipt history here.</small>
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
          <span style="font-size: 0.75rem; color: var(--text-dim); background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;">${ord.payment_method}</span>
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
          TxRef: ${ord.payment ? ord.payment.transaction_ref : 'N/A'} &bull; Shipping to: ${ord.shipping_city}, ${ord.shipping_zip}
        </div>
        <div class="order-total-sum">$${ord.total_amount.toFixed(2)}</div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// SYSTEM DIAGNOSTICS & ARCHITECTURE INSPECTOR
// ==========================================
async function loadDiagnostics() {
  try {
    const res = await fetch(`${API_BASE}/monolith/diagnostics`);
    const data = await res.json();

    // Top metrics
    document.getElementById('diagPid').textContent = `PID: ${data.serverInfo.pid}`;
    document.getElementById('diagUptime').textContent = `Uptime: ${data.serverInfo.uptimeSeconds}s`;
    document.getElementById('diagMemory').textContent = `${data.serverInfo.memory.rssMB} MB RSS`;
    document.getElementById('diagHeap').textContent = `Heap: ${data.serverInfo.memory.heapUsedMB} MB`;
    document.getElementById('diagDbFile').textContent = data.monolithicDatabase.dbFile;

    // Internal Modules Grid
    const modulesGrid = document.getElementById('internalModulesGrid');
    if (modulesGrid && data.internalComponents) {
      modulesGrid.innerHTML = data.internalComponents.map(c => `
        <div class="module-chip">
          <strong>${c.name}</strong>
          <span>${c.role}</span>
        </div>
      `).join('');
    }

    // Shared DB Table stats
    const statsPills = document.getElementById('tableStatsPills');
    if (statsPills && data.monolithicDatabase.tableStats) {
      const stats = data.monolithicDatabase.tableStats;
      statsPills.innerHTML = Object.keys(stats).map(tbl => `
        <span class="table-pill">${tbl}: ${stats[tbl]} rows</span>
      `).join('');
    }

    // Trace Logs Table
    const tbody = document.getElementById('traceTableBody');
    if (tbody && data.recentExecutionTraces) {
      if (data.recentExecutionTraces.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 24px;">No traces logged yet. Interact with the store to populate traces.</td></tr>`;
      } else {
        tbody.innerHTML = data.recentExecutionTraces.map(t => `
          <tr>
            <td style="font-family: monospace; font-size: 0.75rem;">${new Date(t.timestamp).toLocaleTimeString()}</td>
            <td><span class="method-tag ${t.method}">${t.method}</span></td>
            <td style="font-family: monospace; color: #fff;">${t.endpoint}</td>
            <td class="pipeline-code">${t.internal_modules_invoked}</td>
            <td style="color: var(--accent-green); font-weight: 600;">${t.duration_ms} ms</td>
            <td>${t.memory_rss_mb} MB</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load diagnostics', err);
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
