const state = {
  isAuthenticated: false,
  categories: [],
  products: [],
  settings: {},
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function showElement(element, visible) {
  if (!element) return;
  element.classList.toggle('hidden', !visible);
}

function setDashboardStats(stats) {
  document.getElementById('statTotalProducts').textContent = String(stats.totalProducts || 0);
  document.getElementById('statActiveProducts').textContent = String(stats.activeProducts || 0);
  document.getElementById('statUnavailableProducts').textContent = String(stats.unavailableProducts || 0);
  document.getElementById('statPromoProducts').textContent = String(stats.promoProducts || 0);
  document.getElementById('statTotalCategories').textContent = String(stats.totalCategories || 0);
}

async function checkAuth() {
  try {
    const response = await fetch('/api/admin/me', { credentials: 'same-origin' });
    if (!response.ok) {
      state.isAuthenticated = false;
      showElement(document.getElementById('loginSection'), true);
      showElement(document.getElementById('adminDashboard'), false);
      showElement(document.getElementById('logoutBtn'), false);
      return;
    }

    state.isAuthenticated = true;
    showElement(document.getElementById('loginSection'), false);
    showElement(document.getElementById('adminDashboard'), true);
    showElement(document.getElementById('logoutBtn'), true);
    await Promise.all([loadDashboard(), loadCategories(), loadProducts(), loadSettings()]);
  } catch (error) {
    console.error(error);
  }
}

async function loadDashboard() {
  const response = await fetch('/api/admin/dashboard');
  if (!response.ok) return;
  const stats = await response.json();
  setDashboardStats(stats);
}

async function loadCategories() {
  const response = await fetch('/api/admin/categories');
  if (!response.ok) return;
  const categories = await response.json();
  state.categories = categories;
  const list = document.getElementById('categoryList');
  const categorySelect = document.getElementById('productCategorySelect');

  if (categorySelect) {
    categorySelect.innerHTML = categories.map((category) => `<option value="${Number(category.id)}">${escapeHTML(category.name)}</option>`).join('');
  }

  if (list) {
    list.innerHTML = categories.length
      ? categories.map((category) => `
        <div class="list-item">
          <span>${escapeHTML(category.name)}</span>
          <div>
            <button type="button" class="button button-secondary small-button" data-edit-category="${category.id}">Editar</button>
            <button type="button" class="button button-primary small-button" data-delete-category="${category.id}">Excluir</button>
          </div>
        </div>
      `).join('')
      : '<p class="empty-state">Nenhuma categoria cadastrada.</p>';
  }

  document.querySelectorAll('[data-edit-category]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = categories.find((item) => item.id === Number(button.dataset.editCategory));
      if (!category) return;
      const form = document.getElementById('categoryForm');
      form.categoryId.value = category.id;
      form.categoryName.value = category.name;
      form.categoryStatus.value = category.status || 'active';
    });
  });

  document.querySelectorAll('[data-delete-category]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.deleteCategory);
      const confirmed = window.confirm('Deseja realmente excluir esta categoria?');
      if (!confirmed) return;

      const response = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.message || 'Não foi possível excluir a categoria.');
        return;
      }
      alert(payload.message || 'Categoria excluída com sucesso.');
      loadCategories();
      loadProducts();
    });
  });
}

async function loadProducts() {
  const response = await fetch('/api/admin/products');
  if (!response.ok) return;
  const products = await response.json();
  state.products = products;
  const list = document.getElementById('productList');
  if (list) {
    list.innerHTML = products.length
      ? products.map((product) => `
        <div class="list-item product-item">
          <div class="product-preview">
            ${product.image ? `<img src="${escapeHTML(product.image)}" alt="" loading="lazy" />` : '<span class="product-image-empty" aria-hidden="true"></span>'}
            <div>
              <strong>${escapeHTML(product.name)}</strong>
              <small>${escapeHTML(product.categoryName || 'Sem categoria')}</small>
            </div>
          </div>
          <div>
            <button type="button" class="button button-secondary small-button" data-edit-product="${product.id}">Editar</button>
            <button type="button" class="button button-primary small-button" data-delete-product="${product.id}">Excluir</button>
          </div>
        </div>
      `).join('')
      : '<p class="empty-state">Nenhum produto cadastrado.</p>';
  }

  document.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((item) => item.id === Number(button.dataset.editProduct));
      if (!product) return;
      const form = document.getElementById('productForm');
      form.productId.value = product.id;
      form.name.value = product.name || '';
      form.description.value = product.description || '';
      form.categoryId.value = String(product.categoryId || '');
      form.price.value = Number(product.price || 0);
      form.promotionalPrice.value = Number(product.promotionalPrice || 0);
      form.stock.value = Number(product.stock || 0);
      form.unit.value = product.unit || 'unidade';
      form.image.value = product.image || '';
      form.status.value = product.status || 'active';
      form.available.value = product.available ? '1' : '0';
      form.featured.value = product.featured ? '1' : '0';
      form.promotion.value = product.promotion ? '1' : '0';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.deleteProduct);
      const confirmed = window.confirm('Deseja remover este produto?');
      if (!confirmed) return;
      const response = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.message || 'Não foi possível remover o produto.');
        return;
      }
      alert(payload.message || 'Produto removido com sucesso.');
      loadProducts();
      loadDashboard();
    });
  });
}

async function loadSettings() {
  const response = await fetch('/api/admin/settings');
  if (!response.ok) return;
  const settings = await response.json();
  state.settings = settings;
  const form = document.getElementById('settingsForm');
  if (!form) return;
  form.storeName.value = settings.storeName || 'DOMUS CONVENIÊNCIA';
  form.whatsappNumber.value = settings.whatsappNumber || '';
  form.whatsappMessage.value = settings.whatsappMessage || 'Olá! Gostaria de realizar um pedido na Domus Conveniência.';
  form.deliveryEnabled.value = settings.deliveryEnabled === '1' || settings.deliveryEnabled === 1 ? '1' : '0';
  form.pickupEnabled.value = settings.pickupEnabled === '1' || settings.pickupEnabled === 1 ? '1' : '0';
  form.contactInfo.value = settings.contactInfo || '';
}

async function uploadProductImage(file) {
  if (!file) return '';
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || 'Não foi possível fazer upload da imagem.');
  }
  return payload.imageUrl || '';
}

async function submitCategory(event) {
  event.preventDefault();
  const form = event.target;
  const id = form.categoryId.value;
  const payload = {
    name: form.categoryName.value,
    status: form.categoryStatus.value,
  };

  const response = await fetch(id ? `/api/admin/categories/${id}` : '/api/admin/categories', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || 'Não foi possível salvar a categoria.');
    return;
  }

  form.reset();
  loadCategories();
  loadDashboard();
}

async function submitProduct(event) {
  event.preventDefault();
  const form = event.target;
  const fileInput = form.productImage;
  const productId = form.productId.value ? Number(form.productId.value) : null;

  try {
    let image = form.image.value || '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      image = await uploadProductImage(fileInput.files[0]);
    }

    const payload = {
      name: form.name.value,
      description: form.description.value,
      categoryId: form.categoryId.value,
      price: form.price.value,
      promotionalPrice: form.promotionalPrice.value,
      image,
      stock: form.stock.value,
      unit: form.unit.value || 'unidade',
      status: form.status.value,
      available: form.available.value,
      featured: form.featured.value,
      promotion: form.promotion.value,
    };

    const response = await fetch(productId ? `/api/admin/products/${productId}` : '/api/admin/products', {
      method: productId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || 'Não foi possível salvar o produto.');
      return;
    }

    form.reset();
    loadProducts();
    loadDashboard();
  } catch (error) {
    alert(error.message || 'Erro ao salvar o produto.');
  }
}

async function submitSettings(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    storeName: form.storeName.value,
    whatsappNumber: form.whatsappNumber.value,
    whatsappMessage: form.whatsappMessage.value,
    deliveryEnabled: form.deliveryEnabled.value === '1',
    pickupEnabled: form.pickupEnabled.value === '1',
    contactInfo: form.contactInfo.value,
  };

  const response = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || 'Não foi possível salvar as configurações.');
    return;
  }

  alert(data.message || 'Configurações salvas com sucesso.');
}

async function login(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;

  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json();
  if (!response.ok) {
    alert(payload.message || 'Erro ao fazer login.');
    return;
  }

  form.reset();
  checkAuth();
}

async function logout() {
  const response = await fetch('/api/admin/logout', { method: 'POST' });
  const payload = await response.json();
  if (response.ok) {
    alert(payload.message || 'Logout realizado com sucesso.');
    checkAuth();
  }
}

function attachEvents() {
  document.getElementById('loginForm')?.addEventListener('submit', login);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('categoryForm')?.addEventListener('submit', submitCategory);
  document.getElementById('productForm')?.addEventListener('submit', submitProduct);
  document.getElementById('settingsForm')?.addEventListener('submit', submitSettings);
  document.getElementById('resetCategoryForm')?.addEventListener('click', () => {
    const form = document.getElementById('categoryForm');
    form.reset();
    form.categoryId.value = '';
  });
  document.getElementById('resetProductForm')?.addEventListener('click', () => {
    const form = document.getElementById('productForm');
    form.reset();
    form.productId.value = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  checkAuth();
});
