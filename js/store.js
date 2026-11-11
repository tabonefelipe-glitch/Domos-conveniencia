const DOMUS_CART_KEY = 'domus-cart-v1';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const state = {
  settings: null,
  products: [],
  categories: [],
  cart: loadCart(),
  orderDraft: null,
};

function loadCart() {
  try {
    const raw = localStorage.getItem(DOMUS_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(DOMUS_CART_KEY, JSON.stringify(state.cart));
}

function getCartCount() {
  return state.cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function getProductPrice(product) {
  if (product.promotion && Number(product.promotionalPrice) > 0) {
    return Number(product.promotionalPrice);
  }
  return Number(product.price || 0);
}

function updateCartBadge() {
  const countEls = document.querySelectorAll('[data-cart-count]');
  countEls.forEach((element) => {
    element.textContent = String(getCartCount());
  });
}

function getPriceLabel(product) {
  const activePrice = getProductPrice(product);
  if (product.promotionalPrice && Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0)) {
    return `${formatMoney(activePrice)}`;
  }
  return formatMoney(activePrice);
}

function openCart(forceOpen = true) {
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  drawer.classList.toggle('is-open', forceOpen);
  drawer.setAttribute('aria-hidden', String(!forceOpen));
}

function closeCart() {
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
}

function updateCartSummary() {
  const cartList = document.getElementById('cartList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const clearCartBtn = document.getElementById('clearCartBtn');

  if (!cartList) return;

  if (state.cart.length === 0) {
    cartList.innerHTML = '<p class="empty-cart">Seu carrinho está vazio.</p>';
    if (subtotalEl) subtotalEl.textContent = 'R$ 0,00';
    if (totalEl) totalEl.textContent = 'R$ 0,00';
    if (checkoutBtn) checkoutBtn.disabled = true;
    if (clearCartBtn) clearCartBtn.disabled = true;
    updateCartBadge();
    return;
  }

  let subtotal = 0;
  cartList.innerHTML = state.cart.map((item) => {
    const product = item.product;
    const lineTotal = getProductPrice(product) * item.quantity;
    subtotal += lineTotal;
    return `
      <article class="cart-item">
        <img src="${product.image || '/assets/images/default-product.jpg'}" alt="${product.name}" />
        <div class="cart-item-copy">
          <div class="cart-item-topline">
            <h3>${product.name}</h3>
            <button type="button" class="trash-button" data-remove-item="${product.id}" aria-label="Remover ${product.name}">
              <svg class="icon-inline" aria-hidden="true"><use href="#icon-trash"></use></svg>
            </button>
          </div>
          <div class="qty-row">
            <button type="button" data-qty-change="-${product.id}" aria-label="Diminuir quantidade">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-qty-change="+${product.id}" aria-label="Aumentar quantidade">+</button>
          </div>
          <strong>${formatMoney(lineTotal)}</strong>
        </div>
      </article>
    `;
  }).join('');

  if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
  if (totalEl) totalEl.textContent = formatMoney(subtotal);
  if (checkoutBtn) checkoutBtn.disabled = false;
  if (clearCartBtn) clearCartBtn.disabled = false;
  updateCartBadge();

  cartList.querySelectorAll('[data-remove-item]').forEach((button) => {
    button.addEventListener('click', () => removeFromCart(Number(button.dataset.removeItem)));
  });

  cartList.querySelectorAll('[data-qty-change]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = Number(button.dataset.qtyChange.replace(/[+\-]/g, ''));
      const direction = button.dataset.qtyChange.startsWith('+') ? 1 : -1;
      changeQuantity(targetId, direction);
    });
  });
}

function addToCart(product, quantity = 1) {
  const safeProduct = { ...product, available: product.available !== false };
  if (!safeProduct.available) {
    return;
  }

  const existing = state.cart.find((item) => item.product.id === safeProduct.id);
  if (existing) {
    const nextQty = existing.quantity + quantity;
    const maxStock = Number(safeProduct.stock || 999);
    existing.quantity = Math.min(nextQty, maxStock || nextQty);
  } else {
    state.cart.push({ product: safeProduct, quantity });
  }

  saveCart();
  updateCartSummary();
  openCart(true);
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.product.id !== productId);
  saveCart();
  updateCartSummary();
}

function changeQuantity(productId, delta) {
  const item = state.cart.find((entry) => entry.product.id === productId);
  if (!item) return;
  const nextQty = item.quantity + delta;
  if (nextQty <= 0) {
    removeFromCart(productId);
    return;
  }

  const maxStock = Number(item.product.stock || 0);
  item.quantity = maxStock > 0 ? Math.min(nextQty, maxStock) : nextQty;
  saveCart();
  updateCartSummary();
}

function clearCart() {
  state.cart = [];
  saveCart();
  updateCartSummary();
}

function renderProducts(products) {
  const productGrid = document.getElementById('productGrid');
  if (!productGrid) return;

  if (!products.length) {
    productGrid.innerHTML = '<div class="empty-state">Nenhum produto encontrado para essa busca.</div>';
    return;
  }

  productGrid.innerHTML = products.map((product) => {
    const hasDiscount = Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0);
    const isAvailable = product.available !== false && Number(product.stock || 0) > 0;
    const productPrice = getProductPrice(product);
    return `
      <article class="product-card ${!isAvailable ? 'is-disabled' : ''}">
        <button type="button" class="product-image-button" data-open-product="${product.id}" aria-label="Abrir ${product.name}">
          <img src="${product.image || '/assets/images/default-product.jpg'}" alt="${product.name}" />
          ${hasDiscount ? '<span class="promo-badge">Promoção</span>' : ''}
          ${product.featured ? '<span class="featured-badge">Destaque</span>' : ''}
          ${!isAvailable ? '<span class="unavailable-badge">Indisponível</span>' : ''}
        </button>
        <div class="product-body">
          <div class="product-meta">
            <span>${product.categoryName || 'Produtos'}</span>
            ${hasDiscount ? '<small>Promo</small>' : ''}
          </div>
          <h3>${product.name}</h3>
          <p>${product.description || 'Produto da Domus Conveniência.'}</p>
          <div class="product-price-row">
            <div>
              ${hasDiscount ? `<strong>${formatMoney(productPrice)}</strong><span class="old-price">${formatMoney(product.price)}</span>` : `<strong>${formatMoney(productPrice)}</strong>`}
            </div>
            <span class="unit-label">${product.unit || 'unidade'}</span>
          </div>
          <div class="product-actions">
            <button type="button" class="button button-primary" data-add-cart="${product.id}" ${!isAvailable ? 'disabled' : ''}>${isAvailable ? 'Adicionar' : 'Indisponível'}</button>
            <button type="button" class="button button-secondary" data-open-product="${product.id}">Detalhes</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-add-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((entry) => entry.id === Number(button.dataset.addCart));
      if (product) addToCart(product, 1);
    });
  });

  document.querySelectorAll('[data-open-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((entry) => entry.id === Number(button.dataset.openProduct));
      if (product) openProductModal(product);
    });
  });
}

function openProductModal(product) {
  const modal = document.getElementById('productModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;

  const available = product.available !== false && Number(product.stock || 0) > 0;
  const price = getProductPrice(product);
  const oldPrice = Number(product.price || 0);

  content.innerHTML = `
    <div class="product-modal-visual">
      <img src="${product.image || '/assets/images/default-product.jpg'}" alt="${product.name}" />
    </div>
    <div class="product-modal-copy">
      <p class="eyebrow"><span class="eyebrow-line"></span> ${product.categoryName || 'Produto'}</p>
      <h3 id="productModalTitle">${product.name}</h3>
      <p>${product.description || 'Produto disponível na Domus Conveniência.'}</p>
      <div class="product-price-row">
        <div>
          ${Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0) ? `<strong>${formatMoney(price)}</strong><span class="old-price">${formatMoney(oldPrice)}</span>` : `<strong>${formatMoney(price)}</strong>`}
        </div>
        <span class="unit-label">${product.unit || 'unidade'}</span>
      </div>
      <div class="quantity-selector">
        <button type="button" id="decreaseQty" aria-label="Diminuir quantidade">-</button>
        <span id="currentQty">1</span>
        <button type="button" id="increaseQty" aria-label="Aumentar quantidade">+</button>
      </div>
      <button type="button" class="button button-primary" id="modalAddToCart" ${available ? '' : 'disabled'}>${available ? 'Adicionar ao carrinho' : 'Indisponível'}</button>
    </div>
  `;

  let quantity = 1;
  const qtyEl = document.getElementById('currentQty');
  const setQty = (value) => {
    const maxStock = Number(product.stock || 999);
    quantity = Math.max(1, Math.min(value, maxStock || value));
    if (qtyEl) qtyEl.textContent = String(quantity);
  };

  document.getElementById('decreaseQty')?.addEventListener('click', () => setQty(quantity - 1));
  document.getElementById('increaseQty')?.addEventListener('click', () => setQty(quantity + 1));
  document.getElementById('modalAddToCart')?.addEventListener('click', () => {
    addToCart(product, quantity);
    modal.classList.add('hidden');
  });

  modal.classList.remove('hidden');
}

function createMessageFromOrder(order) {
  const productLines = order.items.map((entry) => {
    const value = getProductPrice(entry.product);
    return `${entry.quantity}x ${entry.product.name} — ${formatMoney(value * entry.quantity)}`;
  }).join('\n');

  return [
    'Olá! Gostaria de realizar um pedido na Domus Conveniência.',
    '',
    '*DADOS DO CLIENTE*',
    `Nome: ${order.customerName}`,
    `Atendimento: ${order.orderType === 'delivery' ? 'Delivery' : 'Retirada na loja'}`,
    order.orderType === 'delivery' ? `Endereço: ${order.address}` : 'Endereço: Retirada na loja',
    `Pagamento: ${order.paymentMethod}`,
    '',
    '*MEU PEDIDO*',
    productLines,
    '',
    `*TOTAL: ${formatMoney(order.total)}*`,
    order.notes ? `Observações: ${order.notes}` : '',
    '',
    'Aguardo a confirmação da disponibilidade e do pedido. Obrigado!'
  ].filter(Boolean).join('\n');
}

function openCheckoutForm() {
  const checkoutModal = document.getElementById('checkoutModal');
  if (!checkoutModal) return;
  checkoutModal.classList.remove('hidden');
}

function closeCheckoutForm() {
  const checkoutModal = document.getElementById('checkoutModal');
  if (!checkoutModal) return;
  checkoutModal.classList.add('hidden');
}

function closeReviewModal() {
  const reviewModal = document.getElementById('reviewModal');
  if (reviewModal) reviewModal.classList.add('hidden');
}

function renderReview(order) {
  const reviewContent = document.getElementById('reviewContent');
  if (!reviewContent) return;

  const itemsHtml = order.items.map((entry) => {
    const subtotal = getProductPrice(entry.product) * entry.quantity;
    return `
      <li>
        <span>${entry.quantity}x ${entry.product.name}</span>
        <strong>${formatMoney(subtotal)}</strong>
      </li>
    `;
  }).join('');

  reviewContent.innerHTML = `
    <div class="review-summary-box">
      <p><strong>Cliente:</strong> ${order.customerName}</p>
      <p><strong>Atendimento:</strong> ${order.orderType === 'delivery' ? 'Delivery' : 'Retirada na loja'}</p>
      ${order.orderType === 'delivery' ? `<p><strong>Endereço:</strong> ${order.address}</p>` : ''}
      <p><strong>Pagamento:</strong> ${order.paymentMethod}</p>
      ${order.notes ? `<p><strong>Observações:</strong> ${order.notes}</p>` : ''}
    </div>
    <ul class="review-items">${itemsHtml}</ul>
    <div class="summary-row total-row"><span>Total</span><strong>${formatMoney(order.total)}</strong></div>
  `;
}

async function loadProducts() {
  const search = document.getElementById('productSearch')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || 'all';
  const sort = document.getElementById('sortSelect')?.value || 'featured';

  try {
    const response = await fetch(`/api/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`);
    if (!response.ok) throw new Error('Erro ao carregar produtos');
    const products = await response.json();
    state.products = products;
    renderProducts(products);
  } catch (error) {
    console.error(error);
    const grid = document.getElementById('productGrid');
    if (grid) {
      grid.innerHTML = '<div class="empty-state">Não foi possível carregar os produtos no momento.</div>';
    }
  }
}

async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    state.categories = categories;
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="all">Todas</option>' + categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('');
    }
  } catch (error) {
    console.error(error);
  }
}

async function loadStoreSettings() {
  try {
    const response = await fetch('/api/store/settings');
    state.settings = await response.json();
  } catch (error) {
    console.error(error);
  }
}

function ensureCartShell() {
  if (document.getElementById('cartDrawer')) {
    return;
  }

  const drawer = document.createElement('aside');
  drawer.className = 'cart-drawer';
  drawer.id = 'cartDrawer';
  drawer.setAttribute('aria-label', 'Carrinho de compras');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `
    <div class="cart-header">
      <h2>Seu carrinho</h2>
      <button class="icon-button" type="button" id="cartClose" aria-label="Fechar carrinho">
        <svg class="icon-inline" aria-hidden="true"><use href="#icon-close"></use></svg>
      </button>
    </div>
    <div id="cartList" class="cart-list"></div>
    <div class="cart-summary">
      <div class="summary-row"><span>Subtotal</span><strong id="cartSubtotal">R$ 0,00</strong></div>
      <div class="summary-row"><span>Total</span><strong id="cartTotal">R$ 0,00</strong></div>
      <button type="button" class="button button-primary cart-submit" id="checkoutBtn">Finalizar pedido</button>
      <button type="button" class="button button-secondary cart-clear" id="clearCartBtn">Limpar carrinho</button>
    </div>
  `;
  document.body.appendChild(drawer);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop hidden';
  modal.id = 'checkoutModal';
  modal.innerHTML = `
    <div class="modal-panel checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
      <button type="button" class="icon-button modal-close" id="checkoutClose" aria-label="Fechar pedido">
        <svg class="icon-inline" aria-hidden="true"><use href="#icon-close"></use></svg>
      </button>
      <h2 id="checkoutTitle">Finalizar pedido</h2>
      <form id="checkoutForm" class="checkout-form">
        <label>
          <span>Nome do cliente</span>
          <input type="text" name="customerName" required />
        </label>
        <label>
          <span>Tipo de atendimento</span>
          <select name="orderType" id="orderType">
            <option value="retirada">Retirada na loja</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        <label id="addressField" class="hidden">
          <span>Endereço de entrega</span>
          <textarea name="address" rows="3" placeholder="Rua, número, bairro e referência"></textarea>
        </label>
        <label>
          <span>Forma de pagamento</span>
          <select name="paymentMethod">
            <option value="Pix">Pix</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão">Cartão</option>
          </select>
        </label>
        <label>
          <span>Observações</span>
          <textarea name="notes" rows="3" placeholder="Opcional"></textarea>
        </label>
        <button type="submit" class="button button-primary">Revisar pedido</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const review = document.createElement('div');
  review.className = 'modal-backdrop hidden';
  review.id = 'reviewModal';
  review.innerHTML = `
    <div class="modal-panel review-panel" role="dialog" aria-modal="true" aria-labelledby="reviewTitle">
      <button type="button" class="icon-button modal-close" id="reviewClose" aria-label="Fechar revisão do pedido">
        <svg class="icon-inline" aria-hidden="true"><use href="#icon-close"></use></svg>
      </button>
      <h2 id="reviewTitle">Revisar pedido</h2>
      <div id="reviewContent" class="review-content"></div>
      <button type="button" class="button button-primary" id="sendToWhatsApp">Enviar pedido pelo WhatsApp</button>
    </div>
  `;
  document.body.appendChild(review);

  const floatingButton = document.createElement('button');
  floatingButton.className = 'whatsapp-float';
  floatingButton.type = 'button';
  floatingButton.id = 'floatingCartButton';
  floatingButton.dataset.tooltip = 'Carrinho';
  floatingButton.setAttribute('aria-label', 'Abrir carrinho');
  floatingButton.innerHTML = '<svg class="icon-cart" aria-hidden="true"><use href="#icon-cart"></use></svg>';
  floatingButton.addEventListener('click', () => openCart(true));
  document.body.appendChild(floatingButton);
}

function attachGlobalEvents() {
  ensureCartShell();

  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('checkoutBtn')?.addEventListener('click', openCheckoutForm);
  document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
  document.getElementById('floatingCartButton')?.addEventListener('click', () => openCart(true));
  document.querySelectorAll('[data-cart-trigger]').forEach((button) => {
    button.addEventListener('click', () => openCart(true));
  });

  document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('productModal')?.classList.add('hidden');
  });

  document.getElementById('checkoutClose')?.addEventListener('click', closeCheckoutForm);
  document.getElementById('reviewClose')?.addEventListener('click', closeReviewModal);

  document.getElementById('orderType')?.addEventListener('change', (event) => {
    const addressField = document.getElementById('addressField');
    const shouldShow = event.target.value === 'delivery';
    if (addressField) {
      addressField.classList.toggle('hidden', !shouldShow);
    }
  });

  document.getElementById('checkoutForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const orderType = formData.get('orderType');
    const customerName = String(formData.get('customerName') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const paymentMethod = String(formData.get('paymentMethod') || 'Pix');
    const notes = String(formData.get('notes') || '').trim();

    if (!customerName) {
      alert('Informe o nome do cliente.');
      return;
    }

    if (orderType === 'delivery' && !address) {
      alert('Informe o endereço para delivery.');
      return;
    }

    const total = state.cart.reduce((acc, item) => acc + getProductPrice(item.product) * item.quantity, 0);
    const order = {
      customerName,
      orderType,
      address: orderType === 'delivery' ? address : 'Retirada na loja',
      paymentMethod,
      notes,
      total,
      items: state.cart,
    };
    state.orderDraft = order;
    renderReview(order);
    closeCheckoutForm();
    const reviewModal = document.getElementById('reviewModal');
    if (reviewModal) reviewModal.classList.remove('hidden');
  });

  document.getElementById('sendToWhatsApp')?.addEventListener('click', () => {
    if (!state.orderDraft) return;
    const whatsappNumber = state.settings?.whatsappNumber || '554885003330';
    const message = encodeURIComponent(createMessageFromOrder(state.orderDraft));
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
    closeReviewModal();
    clearCart();
  });

  document.getElementById('productSearch')?.addEventListener('input', () => loadProducts());
  document.getElementById('categoryFilter')?.addEventListener('change', () => loadProducts());
  document.getElementById('sortSelect')?.addEventListener('change', () => loadProducts());

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches('.modal-backdrop')) {
      target.classList.add('hidden');
    }
  });
}

async function initializeStore() {
  await loadStoreSettings();
  await loadCategories();
  await loadProducts();
  attachGlobalEvents();
  updateCartSummary();
  updateCartBadge();
}

document.addEventListener('DOMContentLoaded', initializeStore);
