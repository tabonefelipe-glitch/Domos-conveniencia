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
  sendingOrder: false,
};

function loadCart() {
  try {
    const raw = localStorage.getItem(DOMUS_CART_KEY);
    const items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const product = item.product || {};
      const productId = Number(item.productId ?? product.id);
      const quantity = Number(item.quantity);
      return Number.isInteger(productId) && productId > 0 && Number.isInteger(quantity) && quantity > 0
        ? { productId, product, quantity, unavailable: false }
        : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(DOMUS_CART_KEY, JSON.stringify(state.cart));
  } catch (error) {
    console.error('Não foi possível salvar o carrinho neste navegador.', error);
  }
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

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function getCartItem(productId) {
  return state.cart.find((item) => item.productId === Number(productId));
}

function getCartSubtotal() {
  return state.cart.reduce((total, item) => total + getProductPrice(item.product) * item.quantity, 0);
}

function attachImageFallbacks(container) {
  container.querySelectorAll('img').forEach((image) => {
    image.addEventListener('error', () => {
      const fallbackImage = image.dataset.fallback;
      if (fallbackImage) {
        image.removeAttribute('data-fallback');
        image.src = fallbackImage;
        return;
      }
      const placeholder = document.createElement('span');
      placeholder.className = 'product-image-empty';
      placeholder.setAttribute('role', 'img');
      placeholder.setAttribute('aria-label', `Imagem de ${image.alt || 'produto'} indisponível`);
      image.replaceWith(placeholder);
    });
  });
}

function updateCartBadge() {
  const countEls = document.querySelectorAll('[data-cart-count]');
  countEls.forEach((element) => {
    element.textContent = String(getCartCount());
  });
}

function getPriceLabel(product) {
  const activePrice = getProductPrice(product);
  if (product.promotion && Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0)) {
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
  const mobileCart = document.getElementById('floatingCartButton');
  const mobileTotal = document.getElementById('mobileCartTotal');
  const mobileCount = document.getElementById('mobileCartCount');

  if (!cartList) return;

  if (mobileTotal) mobileTotal.textContent = formatMoney(getCartSubtotal());
  if (mobileCount) mobileCount.textContent = `${getCartCount()} ${getCartCount() === 1 ? 'item' : 'itens'}`;
  if (mobileCart) mobileCart.hidden = getCartCount() === 0 || Boolean(document.querySelector('.landing-quickbar'));

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
      <article class="cart-item ${item.unavailable ? 'is-unavailable' : ''}">
        ${product.image ? `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" />` : '<span class="product-image-empty" aria-hidden="true"></span>'}
        <div class="cart-item-copy">
          <div class="cart-item-topline">
            <h3>${escapeHTML(product.name)}</h3>
            <button type="button" class="trash-button" data-remove-item="${item.productId}" aria-label="Remover ${escapeHTML(product.name)}">
              <svg class="icon-inline" aria-hidden="true"><use href="#icon-trash"></use></svg>
            </button>
          </div>
          <div class="qty-row">
            <button type="button" data-qty-change="-${item.productId}" aria-label="Diminuir quantidade de ${escapeHTML(product.name)}">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-qty-change="+${item.productId}" aria-label="Aumentar quantidade de ${escapeHTML(product.name)}" ${item.unavailable ? 'disabled' : ''}>+</button>
          </div>
          ${item.unavailable ? '<small>Indisponível. Remova para continuar.</small>' : ''}
          <strong>Subtotal: ${formatMoney(lineTotal)}</strong>
        </div>
      </article>
    `;
  }).join('');
  attachImageFallbacks(cartList);

  if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
  if (totalEl) totalEl.textContent = formatMoney(subtotal);
  if (checkoutBtn) checkoutBtn.disabled = state.cart.some((item) => item.unavailable) || state.cart.length === 0;
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
  const safeProduct = { ...product };
  const productId = Number(safeProduct.id);
  if (safeProduct.available !== true || !Number.isInteger(productId)) {
    return;
  }

  const existing = getCartItem(productId);
  if (existing) {
    existing.quantity += quantity;
    existing.product = safeProduct;
    existing.unavailable = false;
  } else {
    state.cart.push({ productId, product: safeProduct, quantity, unavailable: false });
  }

  saveCart();
  updateCartSummary();
  renderLandingFeaturedProducts();
  if (document.getElementById('productGrid')) renderProducts(getVisibleProducts());
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.product.id !== productId);
  saveCart();
  updateCartSummary();
  renderLandingFeaturedProducts();
  if (document.getElementById('productGrid')) renderProducts(getVisibleProducts());
}

function changeQuantity(productId, delta) {
  const item = getCartItem(productId);
  if (!item) return;
  const nextQty = item.quantity + delta;
  if (nextQty <= 0) {
    removeFromCart(productId);
    return;
  }

  if (delta > 0 && item.unavailable) return;
  item.quantity = nextQty;
  saveCart();
  updateCartSummary();
  renderLandingFeaturedProducts();
  if (document.getElementById('productGrid')) renderProducts(getVisibleProducts());
}

function clearCart() {
  state.cart = [];
  saveCart();
  updateCartSummary();
  renderLandingFeaturedProducts();
  if (document.getElementById('productGrid')) renderProducts(getVisibleProducts());
}

function renderProducts(products) {
  const productGrid = document.getElementById('productGrid');
  if (!productGrid) return;

  if (!products.length) {
    productGrid.innerHTML = '<div class="empty-state"><strong>Nenhum produto encontrado</strong><span>Experimente outra busca ou categoria.</span></div>';
    return;
  }

  productGrid.innerHTML = products.map((product) => {
    const hasDiscount = product.promotion && Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0);
    const isAvailable = product.available !== false;
    const productPrice = getProductPrice(product);
    const cartItem = getCartItem(product.id);
    const quantity = cartItem?.quantity || 0;
    return `
      <article class="product-card ${!isAvailable ? 'is-disabled' : ''}">
        <button type="button" class="product-image-button" data-open-product="${product.id}" aria-label="Abrir ${escapeHTML(product.name)}">
          ${product.image ? `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async" />` : '<span class="product-image-empty" aria-hidden="true"></span>'}
          ${hasDiscount ? '<span class="promo-badge">Promoção</span>' : ''}
          ${product.featured ? '<span class="featured-badge">Destaque</span>' : ''}
          ${!isAvailable ? '<span class="unavailable-badge">Indisponível</span>' : ''}
        </button>
        <div class="product-body">
          <div class="product-meta">
            <span>${escapeHTML(product.categoryName || 'Produtos')}</span>
            ${hasDiscount ? '<small>Promo</small>' : ''}
          </div>
          <h3>${escapeHTML(product.name)}</h3>
          <p>${escapeHTML(product.description || 'Produto da Domus Conveniência.')}</p>
          <div class="product-price-row">
            <div>
              ${hasDiscount ? `<strong>${formatMoney(productPrice)}</strong><span class="old-price">${formatMoney(product.price)}</span>` : `<strong>${formatMoney(productPrice)}</strong>`}
            </div>
            <span class="unit-label">${escapeHTML(product.unit || 'unidade')}</span>
          </div>
          <div class="product-actions">
            ${quantity ? `<div class="qty-row product-quantity"><button type="button" data-product-qty="-${product.id}" aria-label="Diminuir ${escapeHTML(product.name)}">-</button><span>${quantity}</span><button type="button" data-product-qty="+${product.id}" aria-label="Aumentar ${escapeHTML(product.name)}" ${!isAvailable ? 'disabled' : ''}>+</button></div>` : ''}
            <button type="button" class="button button-primary" data-add-cart="${product.id}" ${!isAvailable ? 'disabled' : ''}>${isAvailable ? (quantity ? 'Adicionar mais' : 'Adicionar') : 'Indisponível'}</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  attachImageFallbacks(productGrid);

  document.querySelectorAll('[data-add-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((entry) => entry.id === Number(button.dataset.addCart));
      if (product) addToCart(product, 1);
    });
  });

  productGrid.querySelectorAll('[data-product-qty]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.productQty;
      changeQuantity(Number(value.replace(/[+-]/g, '')), value.startsWith('+') ? 1 : -1);
      renderProducts(getVisibleProducts());
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

  const available = product.available !== false;
  const price = getProductPrice(product);
  const oldPrice = Number(product.price || 0);

  content.innerHTML = `
    <div class="product-modal-visual">
      ${product.image ? `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" />` : '<span class="product-image-empty" aria-hidden="true"></span>'}
    </div>
    <div class="product-modal-copy">
      <p class="eyebrow"><span class="eyebrow-line"></span> ${escapeHTML(product.categoryName || 'Produto')}</p>
      <h3 id="productModalTitle">${escapeHTML(product.name)}</h3>
      <p>${escapeHTML(product.description || 'Produto disponível na Domus Conveniência.')}</p>
      <div class="product-price-row">
        <div>
          ${product.promotion && Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0) ? `<strong>${formatMoney(price)}</strong><span class="old-price">${formatMoney(oldPrice)}</span>` : `<strong>${formatMoney(price)}</strong>`}
        </div>
        <span class="unit-label">${escapeHTML(product.unit || 'unidade')}</span>
      </div>
      <div class="quantity-selector">
        <button type="button" id="decreaseQty" aria-label="Diminuir quantidade">-</button>
        <span id="currentQty">1</span>
        <button type="button" id="increaseQty" aria-label="Aumentar quantidade">+</button>
      </div>
      <button type="button" class="button button-primary" id="modalAddToCart" ${available ? '' : 'disabled'}>${available ? 'Adicionar ao carrinho' : 'Indisponível'}</button>
    </div>
  `;
  attachImageFallbacks(content);

  let quantity = 1;
  const qtyEl = document.getElementById('currentQty');
  const setQty = (value) => {
    quantity = Math.max(1, value);
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
    return `- ${entry.quantity}x ${entry.product.name} — ${formatMoney(entry.unitPrice)} cada (${entry.product.unit || 'unidade'}) — ${formatMoney(entry.lineTotal)}`;
  }).join('\n');

  return [
    'Olá! Gostaria de realizar um pedido na Domus Conveniência.',
    '',
    `CLIENTE: ${order.customerName}`,
    '',
    `TIPO DE ATENDIMENTO: ${order.orderType === 'delivery' ? 'Delivery' : 'Retirada'}`,
    ...(order.orderType === 'delivery' ? [
      `ENDEREÇO: ${order.address}, ${order.neighborhood}`,
      order.complement ? `COMPLEMENTO: ${order.complement}` : ''
    ] : []),
    `FORMA DE PAGAMENTO: ${order.paymentMethod}`,
    '',
    'ITENS DO PEDIDO:',
    productLines,
    `SUBTOTAL: ${formatMoney(order.subtotal)}`,
    ...(order.orderType === 'delivery' ? ['TAXA DE ENTREGA: A confirmar pela loja.'] : []),
    `TOTAL: ${order.orderType === 'delivery' ? `${formatMoney(order.subtotal)} + taxa de entrega a confirmar pela loja` : formatMoney(order.total)}`,
    order.notes ? `OBSERVAÇÕES: ${order.notes}` : ''
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
    return `
      <li>
        <span>${entry.quantity}x ${escapeHTML(entry.product.name)}<small>${formatMoney(entry.unitPrice)} cada</small></span>
        <strong>${formatMoney(entry.lineTotal)}</strong>
      </li>
    `;
  }).join('');

  reviewContent.innerHTML = `
    <div class="review-summary-box">
      <p><strong>Cliente:</strong> ${escapeHTML(order.customerName)}</p>
      <p><strong>Atendimento:</strong> ${order.orderType === 'delivery' ? 'Delivery' : 'Retirada na loja'}</p>
      ${order.orderType === 'delivery' ? `<p><strong>Endereço:</strong> ${escapeHTML(order.address)}, ${escapeHTML(order.neighborhood)}</p>${order.complement ? `<p><strong>Complemento:</strong> ${escapeHTML(order.complement)}</p>` : ''}` : ''}
      <p><strong>Pagamento:</strong> ${escapeHTML(order.paymentMethod)}</p>
      ${order.notes ? `<p><strong>Observações:</strong> ${escapeHTML(order.notes)}</p>` : ''}
    </div>
    <ul class="review-items">${itemsHtml}</ul>
    <div class="summary-row"><span>Subtotal dos itens</span><strong>${formatMoney(order.subtotal)}</strong></div>
    ${order.orderType === 'delivery' ? '<p class="delivery-notice">Taxa de entrega a confirmar pela loja.</p>' : ''}
    <div class="summary-row total-row"><span>${order.orderType === 'delivery' ? 'Total + entrega' : 'Total'}</span><strong>${order.orderType === 'delivery' ? `${formatMoney(order.subtotal)} + taxa a confirmar` : formatMoney(order.total)}</strong></div>
  `;
}

function getVisibleProducts() {
  const search = normalizeText(document.getElementById('productSearch')?.value || '');
  const category = document.querySelector('[data-category-filter].is-active')?.dataset.categoryFilter || 'all';
  const sort = document.getElementById('sortSelect')?.value || 'featured';
  const products = state.products.filter((product) => {
    const matchesSearch = !search || normalizeText(product.name).includes(search);
    const matchesCategory = category === 'all' || String(product.categoryId) === category;
    return matchesSearch && matchesCategory;
  });
  const activePrice = (product) => getProductPrice(product);
  if (sort === 'price_asc') products.sort((a, b) => activePrice(a) - activePrice(b));
  else if (sort === 'price_desc') products.sort((a, b) => activePrice(b) - activePrice(a));
  else if (sort === 'name_asc') products.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  else products.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.promotion) - Number(a.promotion));
  return products;
}

function getLandingProductImageFallback(product) {
  const category = normalizeText(product.categoryName);
  if (/bebidas|cervejas|refrigerantes|destilados/.test(category)) return 'assets/images/domus-bebidas.jpg';
  if (/churrasco|carvao/.test(category)) return 'assets/images/domus-churrasco.jpg';
  if (/salgados|lanches|pao de queijo/.test(category)) return 'assets/images/domus-pao-de-queijo.jpg';
  if (/congelados|refrigerados/.test(category)) return 'assets/images/domus-freezer.jpg';
  return '';
}

function renderLandingFeaturedProducts() {
  const grid = document.getElementById('landingFeaturedProducts');
  if (!grid) return;

  const products = state.products
    .filter((product) => product.featured === true && product.available === true)
    .slice(0, 6);
  if (!products.length) {
    grid.innerHTML = '<p class="landing-products-status">Os produtos da loja estarão disponíveis em breve.</p>';
    grid.setAttribute('aria-busy', 'false');
    return;
  }

  grid.innerHTML = products.map((product) => {
    const hasDiscount = product.promotion && Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price || 0);
    const price = getProductPrice(product);
    const cartItem = getCartItem(product.id);
    const quantity = cartItem?.quantity || 0;
    const hasPrice = price > 0;
    const imageFallback = getLandingProductImageFallback(product);
    return `
      <article class="product-card landing-product-card">
        <div class="landing-product-image">
          ${product.image ? `<img src="${escapeHTML(product.image)}"${imageFallback ? ` data-fallback="${escapeHTML(imageFallback)}"` : ''} alt="${escapeHTML(product.name)}" loading="lazy" decoding="async" />` : '<span class="product-image-empty" aria-hidden="true"></span>'}
          ${hasDiscount ? '<span class="promo-badge">Promoção</span>' : ''}
        </div>
        <div class="product-body">
          <div class="product-meta"><span>${escapeHTML(product.categoryName || 'Produtos')}</span></div>
          <h3>${escapeHTML(product.name)}</h3>
          <div class="product-price-row">
            <div>${hasPrice ? (hasDiscount ? `<strong>${formatMoney(price)}</strong><span class="old-price">${formatMoney(product.price)}</span>` : `<strong>${formatMoney(price)}</strong>`) : '<strong>Consulte na loja</strong>'}</div>
            <span class="unit-label">${escapeHTML(product.unit || 'unidade')}</span>
          </div>
          <button type="button" class="button button-primary" data-landing-add="${Number(product.id)}">${quantity ? `Adicionar mais (${quantity})` : 'Adicionar ao carrinho'}</button>
        </div>
      </article>
    `;
  }).join('');
  grid.setAttribute('aria-busy', 'false');
  attachImageFallbacks(grid);
  grid.querySelectorAll('[data-landing-add]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((entry) => Number(entry.id) === Number(button.dataset.landingAdd));
      if (product) addToCart(product, 1);
    });
  });
}

function applyLandingCategoryLinks(categories) {
  const aliases = {
    'pao de queijo e salgados': ['pao de queijo e salgados', 'salgados e lanches', 'salgados'],
    'congelados e refrigerados': ['congelados e refrigerados', 'congelados', 'refrigerados']
  };
  document.querySelectorAll('[data-category-link]').forEach((link) => {
    const requestedName = normalizeText(link.dataset.categoryLink);
    const candidates = aliases[requestedName] || [requestedName];
    const category = categories.find((entry) => candidates.includes(normalizeText(entry.name)));
    if (category) link.href = `/shop.html?category=${Number(category.id)}#produtos`;
  });
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Erro ao carregar produtos');
    const products = await response.json();
    state.products = products;
    const latestById = new Map(products.map((product) => [Number(product.id), product]));
    state.cart = state.cart.map((item) => {
      const current = latestById.get(item.productId);
      return current
        ? { ...item, product: current, unavailable: current.available !== true }
        : { ...item, unavailable: true };
    });
    saveCart();
    renderProducts(getVisibleProducts());
    renderLandingFeaturedProducts();
    updateCartSummary();
  } catch (error) {
    console.error(error);
    const grid = document.getElementById('productGrid');
    if (grid) {
      grid.innerHTML = '<div class="empty-state"><strong>Não foi possível carregar os produtos.</strong><span>Verifique sua conexão e tente novamente.</span></div>';
    }
    const landingGrid = document.getElementById('landingFeaturedProducts');
    if (landingGrid) {
      landingGrid.innerHTML = '<p class="landing-products-status">Não foi possível carregar os produtos agora. Visite a loja para tentar novamente.</p>';
      landingGrid.setAttribute('aria-busy', 'false');
    }
  }
}

async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    state.categories = categories;
    applyLandingCategoryLinks(categories);
    const categoryChips = document.getElementById('categoryChips');
    if (categoryChips) {
      const requestedCategory = new URLSearchParams(window.location.search).get('category');
      const selectedCategory = categories.some((category) => String(category.id) === requestedCategory) ? requestedCategory : 'all';
      categoryChips.innerHTML = [
        `<button type="button" class="category-chip ${selectedCategory === 'all' ? 'is-active' : ''}" data-category-filter="all" aria-pressed="${selectedCategory === 'all'}">Todas</button>`,
        ...categories.map((category) => {
          const isSelected = String(category.id) === selectedCategory;
          return `<button type="button" class="category-chip ${isSelected ? 'is-active' : ''}" data-category-filter="${Number(category.id)}" aria-pressed="${isSelected}">${escapeHTML(category.name)}</button>`;
        })
      ].join('');
      categoryChips.querySelectorAll('[data-category-filter]').forEach((button) => {
        button.addEventListener('click', () => {
          categoryChips.querySelector('.is-active')?.classList.remove('is-active');
          categoryChips.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
          button.classList.add('is-active');
          button.setAttribute('aria-pressed', 'true');
          renderProducts(getVisibleProducts());
        });
      });
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
          <span>Endereço</span>
          <input type="text" name="address" autocomplete="street-address" maxlength="180" placeholder="Rua e número" />
        </label>
        <label id="neighborhoodField" class="hidden">
          <span>Bairro</span>
          <input type="text" name="neighborhood" autocomplete="address-level3" maxlength="100" />
        </label>
        <label id="complementField" class="hidden">
          <span>Complemento (opcional)</span>
          <input type="text" name="complement" autocomplete="address-line2" maxlength="120" />
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
          <textarea name="notes" rows="3" maxlength="500" placeholder="Opcional"></textarea>
        </label>
        <p class="privacy-note">Ao continuar, seus dados serão incluídos na mensagem do WhatsApp. <a href="/privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>.</p>
        <p class="order-error" id="checkoutError" role="alert" hidden></p>
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
      <p class="order-error" id="reviewError" role="alert" hidden></p>
      <button type="button" class="button button-primary" id="sendToWhatsApp">Enviar pedido pelo WhatsApp</button>
    </div>
  `;
  document.body.appendChild(review);

  const floatingButton = document.createElement('button');
  floatingButton.className = 'whatsapp-float';
  floatingButton.type = 'button';
  floatingButton.id = 'floatingCartButton';
  floatingButton.dataset.tooltip = 'Abrir carrinho';
  floatingButton.setAttribute('aria-label', 'Abrir carrinho');
  floatingButton.innerHTML = '<svg class="icon-cart" aria-hidden="true"><use href="#icon-cart"></use></svg><span id="mobileCartCount">0 itens</span><strong id="mobileCartTotal">R$ 0,00</strong>';
  floatingButton.hidden = true;
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
    const neighborhoodField = document.getElementById('neighborhoodField');
    const complementField = document.getElementById('complementField');
    const shouldShow = event.target.value === 'delivery';
    [addressField, neighborhoodField, complementField].forEach((field) => field?.classList.toggle('hidden', !shouldShow));
    const address = document.querySelector('[name="address"]');
    const neighborhood = document.querySelector('[name="neighborhood"]');
    if (address) address.required = shouldShow;
    if (neighborhood) neighborhood.required = shouldShow;
  });
  const orderTypeSelect = document.getElementById('orderType');
  if (orderTypeSelect) orderTypeSelect.dispatchEvent(new Event('change'));

  document.getElementById('checkoutForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById('checkoutError');
    if (errorEl) errorEl.hidden = true;
    if (!state.cart.length || state.cart.some((item) => item.unavailable)) {
      if (errorEl) {
        errorEl.textContent = 'Atualize ou remova os itens indisponíveis antes de continuar.';
        errorEl.hidden = false;
      }
      return;
    }
    const formData = new FormData(event.target);
    const orderType = formData.get('orderType');
    const customerName = String(formData.get('customerName') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const neighborhood = String(formData.get('neighborhood') || '').trim();
    const complement = String(formData.get('complement') || '').trim();
    const paymentMethod = String(formData.get('paymentMethod') || 'Pix');
    const notes = String(formData.get('notes') || '').trim();

    if (!customerName) {
      alert('Informe o nome do cliente.');
      return;
    }

    if (orderType === 'delivery' && (!address || !neighborhood)) {
      if (errorEl) {
        errorEl.textContent = 'Informe o endereço e o bairro para delivery.';
        errorEl.hidden = false;
      }
      return;
    }

    const submitButton = event.target.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const quote = await validateCart();
      state.orderDraft = {
        customerName,
        orderType,
        address,
        neighborhood,
        complement,
        paymentMethod,
        notes,
        ...quote
      };
      renderReview(state.orderDraft);
      closeCheckoutForm();
      document.getElementById('reviewModal')?.classList.remove('hidden');
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.hidden = false;
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById('sendToWhatsApp')?.addEventListener('click', async (event) => {
    if (!state.orderDraft || state.sendingOrder) return;
    const button = event.currentTarget;
    const errorEl = document.getElementById('reviewError');
    if (errorEl) errorEl.hidden = true;
    const whatsappNumber = String(state.settings?.whatsappNumber || '').replace(/\D/g, '');
    if (!/^55\d{10,11}$/.test(whatsappNumber)) {
      if (errorEl) {
        errorEl.textContent = 'O WhatsApp da loja não está configurado corretamente. Entre em contato com a loja.';
        errorEl.hidden = false;
      }
      return;
    }

    const whatsappWindow = window.open('about:blank', '_blank');
    if (!whatsappWindow) {
      if (errorEl) {
        errorEl.textContent = 'O navegador bloqueou a janela do WhatsApp. Permita pop-ups e tente novamente.';
        errorEl.hidden = false;
      }
      return;
    }

    state.sendingOrder = true;
    button.disabled = true;
    try {
      const quote = await validateCart();
      const previousQuote = state.orderDraft;
      const quoteChanged = quote.subtotal !== previousQuote.subtotal || quote.items.some((item, index) => {
        const previous = previousQuote.items[index];
        return !previous || item.product.id !== previous.product.id || item.product.name !== previous.product.name ||
          item.product.unit !== previous.product.unit || item.quantity !== previous.quantity || item.unitPrice !== previous.unitPrice;
      }) || quote.items.length !== previousQuote.items.length;

      if (quoteChanged) {
        whatsappWindow.close();
        state.orderDraft = { ...previousQuote, ...quote };
        renderReview(state.orderDraft);
        if (errorEl) {
          errorEl.textContent = 'Os preços, produtos ou a disponibilidade mudaram. Confira o pedido atualizado e envie novamente.';
          errorEl.hidden = false;
        }
        return;
      }

      const order = { ...previousQuote, ...quote };
      const message = encodeURIComponent(createMessageFromOrder(order));
      whatsappWindow.location.href = `https://wa.me/${whatsappNumber}?text=${message}`;
      closeReviewModal();
      closeCart();
      clearCart();
    } catch (error) {
      whatsappWindow.close();
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.hidden = false;
      }
    } finally {
      state.sendingOrder = false;
      button.disabled = false;
    }
  });

  document.getElementById('productSearch')?.addEventListener('input', () => renderProducts(getVisibleProducts()));
  document.getElementById('sortSelect')?.addEventListener('change', () => renderProducts(getVisibleProducts()));

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
  const orderType = document.getElementById('orderType');
  if (orderType && state.settings) {
    const deliveryOption = orderType.querySelector('option[value="delivery"]');
    const pickupOption = orderType.querySelector('option[value="retirada"]');
    if (deliveryOption) deliveryOption.disabled = !state.settings.deliveryEnabled;
    if (pickupOption) pickupOption.disabled = !state.settings.pickupEnabled;
    if (deliveryOption?.disabled && pickupOption && !pickupOption.disabled) orderType.value = 'retirada';
    if (pickupOption?.disabled && deliveryOption && !deliveryOption.disabled) orderType.value = 'delivery';
    orderType.dispatchEvent(new Event('change'));
  }
  await loadProducts();
  attachGlobalEvents();
  updateCartSummary();
  updateCartBadge();
}

async function validateCart() {
  const response = await fetch('/api/orders/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: state.cart.map((item) => ({ productId: item.productId, quantity: item.quantity })) })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Não foi possível validar o carrinho.');
  return payload;
}

document.addEventListener('DOMContentLoaded', initializeStore);
