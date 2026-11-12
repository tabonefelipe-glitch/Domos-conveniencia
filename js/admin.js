const state = {
  isAuthenticated: false,
  categories: [],
  products: [],
  settings: {},
  stats: {},
  user: null,
  page: 'overview',
  productQuery: '',
  productCategory: '',
  productStatus: '',
  productAvailability: '',
  productPromotion: '',
  productPage: 1,
  pageSize: 10,
  toastTimer: null,
  confirmAction: null,
  imagePreviewUrl: null,
};

const pageNames = {
  overview: 'Visão geral',
  products: 'Produtos',
  categories: 'Categorias',
  settings: 'Configurações da loja',
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function imageSource(value) {
  const image = String(value || '').trim();
  return /^https:\/\//i.test(image) || /^\/(uploads|assets\/images)\//i.test(image) ? image : '';
}

function icon(name, className = '') {
  const paths = {
    box: '<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    tag: '<path d="M20.6 13.4 11 3.8A2 2 0 0 0 9.6 3H4a1 1 0 0 0-1 1v5.6A2 2 0 0 0 3.6 11l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.4a2 2 0 0 0 0-2.8Z"/><circle cx="7.5" cy="7.5" r=".75"/>',
    chart: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
  };
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a solicitação.');
  return payload;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}

function showToast(message, type = 'success') {
  const region = document.getElementById('toastRegion');
  region.innerHTML = `<div class="admin-toast ${type === 'error' ? 'is-error' : ''}" role="${type === 'error' ? 'alert' : 'status'}"><span class="toast-mark" aria-hidden="true">${type === 'error' ? '!' : '✓'}</span><span>${escapeHTML(message)}</span><button type="button" class="toast-close" aria-label="Fechar notificação">${icon('close')}</button></div>`;
  region.querySelector('.toast-close').addEventListener('click', () => { region.innerHTML = ''; });
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => { region.innerHTML = ''; }, 4500);
}

function setBusy(button, busy, busyText = 'Salvando...') {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent.trim();
    button.textContent = busyText;
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
  button.disabled = busy;
  button.classList.toggle('is-loading', busy);
}

function updateStoreIdentity() {
  const name = state.settings.storeName || 'Domus Conveniência';
  document.getElementById('sidebarStoreName').textContent = name;
  document.getElementById('topbarStoreName').textContent = name;
  document.getElementById('navProductCount').textContent = String(state.products.length);
}

function showView(authenticated) {
  document.getElementById('authLoading').classList.add('hidden');
  document.getElementById('loginView').classList.toggle('hidden', authenticated);
  document.getElementById('adminApp').classList.toggle('hidden', !authenticated);
}

async function checkAuth() {
  try {
    const payload = await requestJSON('/api/admin/me');
    state.isAuthenticated = true;
    state.user = payload.user || null;
    showView(true);
    await loadAll();
    return true;
  } catch (error) {
    state.isAuthenticated = false;
    showView(false);
    if (error instanceof TypeError) showToast('Não foi possível conectar ao servidor. Verifique sua conexão.', 'error');
    return false;
  }
}

async function loadAll() {
  const pageContent = document.getElementById('pageContent');
  pageContent.innerHTML = '<div class="page-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Carregando dados da loja...</span></div>';
  try {
    const [stats, categories, products, settings] = await Promise.all([
      requestJSON('/api/admin/dashboard'),
      requestJSON('/api/admin/categories'),
      requestJSON('/api/admin/products'),
      requestJSON('/api/admin/settings'),
    ]);
    state.stats = stats;
    state.categories = categories;
    state.products = products;
    state.settings = settings;
    updateStoreIdentity();
    renderPage();
  } catch (error) {
    pageContent.innerHTML = `<div class="admin-empty-state"><span class="empty-symbol">!</span><h2>Não foi possível carregar os dados</h2><p>${escapeHTML(error.message)}</p><button class="admin-button admin-button-secondary" type="button" data-action="reload">Tentar novamente</button></div>`;
  }
}

function statCard(label, value, iconName, tone) {
  return `<article class="metric-card"><span class="metric-icon ${tone}">${icon(iconName)}</span><span class="metric-label">${label}</span><strong>${Number(value || 0).toLocaleString('pt-BR')}</strong></article>`;
}

function productThumb(product, extraClass = '') {
  const source = imageSource(product.image);
  return source
    ? `<img class="product-thumb ${extraClass}" src="${escapeHTML(source)}" alt="" loading="lazy" />`
    : `<span class="product-thumb product-thumb-empty ${extraClass}" aria-hidden="true">${icon('image')}</span>`;
}

function productStatus(product) {
  if (product.status !== 'active') return '<span class="status-pill status-muted"><i></i>Inativo</span>';
  if (!product.available) return '<span class="status-pill status-warning"><i></i>Indisponível</span>';
  return '<span class="status-pill status-success"><i></i>Ativo</span>';
}

function renderDashboard() {
  const recent = [...state.products].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)).slice(0, 5);
  const lowStock = state.products.filter((product) => Number(product.stock) <= 5).sort((a, b) => Number(a.stock) - Number(b.stock)).slice(0, 5);
  const categoryList = state.categories.slice(0, 6);
  const recentContent = recent.length
    ? `<div class="compact-list">${recent.map((product) => `<div class="compact-row">${productThumb(product)}<span class="compact-product-copy"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.categoryName || 'Sem categoria')}</small></span><span class="compact-row-meta">${dateLabel(product.createdAt || product.updatedAt)}</span></div>`).join('')}</div>`
    : `<div class="panel-empty"><span class="empty-symbol">${icon('box')}</span><strong>Nenhum produto por aqui</strong><p>Cadastre o primeiro item para começar a montar sua vitrine.</p><button class="text-action" type="button" data-action="new-product">Cadastrar produto ${icon('arrow')}</button></div>`;
  const lowStockContent = lowStock.length
    ? `<div class="compact-list">${lowStock.map((product) => `<div class="compact-row">${productThumb(product)}<span class="compact-product-copy"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.categoryName || 'Sem categoria')}</small></span><span class="stock-count ${Number(product.stock) === 0 ? 'is-empty' : ''}">${Number(product.stock) === 0 ? 'Sem estoque' : `${Number(product.stock)} un.`}</span></div>`).join('')}</div>`
    : '<div class="panel-empty panel-empty-short"><strong>Estoque em dia</strong><p>Nenhum produto com 5 unidades ou menos.</p></div>';
  const categoriesContent = categoryList.length
    ? `<div class="category-quick-list">${categoryList.map((category) => {
      const count = state.products.filter((product) => Number(product.categoryId) === Number(category.id)).length;
      return `<div class="category-quick-row"><span class="category-mark">${icon('tag')}</span><span><strong>${escapeHTML(category.name)}</strong><small>${count} ${count === 1 ? 'produto' : 'produtos'}</small></span><span class="status-pill ${category.status === 'inactive' ? 'status-muted' : 'status-success'}"><i></i>${category.status === 'inactive' ? 'Inativa' : 'Ativa'}</span></div>`;
    }).join('')}</div><button class="panel-footer-link" type="button" data-page="categories">Ver todas as categorias ${icon('arrow')}</button>`
    : `<div class="panel-empty panel-empty-short"><strong>Nenhuma categoria cadastrada</strong><p>Organize seus produtos por categoria.</p><button class="text-action" type="button" data-action="new-category">Criar categoria ${icon('arrow')}</button></div>`;

  return `<section class="page-intro"><div><p class="admin-eyebrow">RESUMO DA OPERAÇÃO</p><h2>Bom dia, ${escapeHTML((state.user?.name || '').split(' ')[0] || 'bem-vindo')}.</h2><p>Acompanhe os principais números e a atividade da sua loja.</p></div><div class="quick-actions"><button class="admin-button admin-button-secondary" type="button" data-action="new-category">${icon('tag')} Nova categoria</button><button class="admin-button admin-button-primary" type="button" data-action="new-product">${icon('plus')} Novo produto</button></div></section>
    <section class="metrics-grid" aria-label="Indicadores da loja">${statCard('Produtos cadastrados', state.stats.totalProducts, 'box', 'metric-gold')}${statCard('Produtos ativos', state.stats.activeProducts, 'check', 'metric-green')}${statCard('Indisponíveis', state.stats.unavailableProducts, 'box', 'metric-amber')}${statCard('Em promoção', state.stats.promoProducts, 'tag', 'metric-rose')}${statCard('Categorias', state.stats.totalCategories, 'chart', 'metric-charcoal')}</section>
    <section class="dashboard-grid"><article class="admin-panel dashboard-panel"><header class="panel-heading"><div><h3>Produtos recentes</h3><p>Itens adicionados à sua loja</p></div><button class="panel-heading-link" type="button" data-page="products">Ver produtos ${icon('arrow')}</button></header>${recentContent}</article><article class="admin-panel dashboard-panel"><header class="panel-heading"><div><h3>Estoque baixo</h3><p>Produtos com até 5 unidades</p></div><span class="panel-heading-count">${lowStock.length}</span></header>${lowStockContent}<button class="panel-footer-link" type="button" data-page="products">Revisar estoque ${icon('arrow')}</button></article><article class="admin-panel dashboard-panel category-panel"><header class="panel-heading"><div><h3>Categorias</h3><p>Organização do catálogo</p></div><button class="icon-button" type="button" data-action="new-category" aria-label="Nova categoria">${icon('plus')}</button></header>${categoriesContent}</article></section>`;
}

function filteredProducts() {
  const query = state.productQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  return state.products.filter((product) => {
    const nameMatches = !query || product.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(query);
    const categoryMatches = !state.productCategory || Number(product.categoryId) === Number(state.productCategory);
    const statusMatches = !state.productStatus || product.status === state.productStatus;
    const availabilityMatches = !state.productAvailability || (state.productAvailability === 'available' ? product.available : !product.available);
    const promotionMatches = !state.productPromotion || (state.productPromotion === 'yes' ? product.promotion : !product.promotion);
    return nameMatches && categoryMatches && statusMatches && availabilityMatches && promotionMatches;
  });
}

function renderProductRows(products) {
  if (!products.length) return `<tr><td colspan="9"><div class="table-empty"><span class="empty-symbol">${icon('search')}</span><strong>${state.products.length ? 'Nenhum produto encontrado' : 'Sua lista de produtos está vazia'}</strong><p>${state.products.length ? 'Ajuste os filtros para ver outros resultados.' : 'Cadastre seu primeiro produto para começar.'}</p>${state.products.length ? '<button class="text-action" type="button" data-action="clear-filters">Limpar filtros</button>' : '<button class="admin-button admin-button-primary" type="button" data-action="new-product">Cadastrar primeiro produto</button>'}</div></td></tr>`;

  return products.map((product) => `<tr>
    <td>${productThumb(product)}</td>
    <td><div class="table-product-name"><strong>${escapeHTML(product.name)}</strong><span>${product.promotion ? '<span class="table-tag tag-promo">Em promoção</span>' : ''}${product.featured ? '<span class="table-tag tag-featured">Destaque</span>' : ''}</span></div></td>
    <td class="table-secondary">${escapeHTML(product.categoryName || 'Sem categoria')}</td>
    <td><div class="table-price">${money(product.price)}</div></td>
    <td><div class="table-price ${product.promotionalPrice ? 'table-promo-price' : 'table-no-promo'}">${product.promotionalPrice ? money(product.promotionalPrice) : '—'}</div></td>
    <td><span class="stock-value ${Number(product.stock) <= 5 ? 'stock-low' : ''}">${Number(product.stock) <= 5 ? '<i aria-hidden="true"></i>' : ''}${Number(product.stock)} <small>${escapeHTML(product.unit || 'un.')}</small></span></td>
    <td><div class="status-stack">${productStatus(product)}${product.promotion ? '<span class="status-pill status-promo"><i></i>Promoção</span>' : ''}</div></td>
    <td><span class="table-secondary">${dateLabel(product.updatedAt || product.createdAt)}</span></td>
    <td><div class="table-actions"><button class="icon-button" type="button" data-action="edit-product" data-id="${Number(product.id)}" aria-label="Editar ${escapeHTML(product.name)}" title="Editar">${icon('edit')}</button><button class="icon-button" type="button" data-action="toggle-product" data-id="${Number(product.id)}" aria-label="${product.status === 'active' ? 'Desativar' : 'Ativar'} ${escapeHTML(product.name)}" title="${product.status === 'active' ? 'Desativar produto' : 'Ativar produto'}">${icon(product.status === 'active' ? 'close' : 'check')}</button><button class="icon-button icon-button-danger" type="button" data-action="delete-product" data-id="${Number(product.id)}" aria-label="Excluir ${escapeHTML(product.name)}" title="Excluir">${icon('trash')}</button></div></td>
  </tr>`).join('');
}

function renderProducts() {
  const products = filteredProducts();
  const pageCount = Math.max(1, Math.ceil(products.length / state.pageSize));
  state.productPage = Math.min(state.productPage, pageCount);
  const start = (state.productPage - 1) * state.pageSize;
  const visible = products.slice(start, start + state.pageSize);
  const categoryOptions = state.categories.map((category) => `<option value="${Number(category.id)}">${escapeHTML(category.name)}</option>`).join('');

  return `<section class="page-intro"><div><p class="admin-eyebrow">CATÁLOGO DA LOJA</p><h2>Produtos</h2><p>Gerencie itens, preços, estoque e disponibilidade.</p></div><button class="admin-button admin-button-primary" type="button" data-action="new-product">${icon('plus')} Novo produto</button></section>
    <section class="admin-panel products-panel"><div class="product-toolbar"><label class="search-field">${icon('search')}<span class="sr-only">Pesquisar produtos</span><input id="productSearch" type="search" value="${escapeHTML(state.productQuery)}" placeholder="Buscar por nome do produto" autocomplete="off" /></label><label class="filter-field"><span class="sr-only">Filtrar por categoria</span><select id="productCategoryFilter"><option value="">Todas as categorias</option>${categoryOptions}</select></label><label class="filter-field"><span class="sr-only">Filtrar por status</span><select id="productStatusFilter"><option value="">Todos os status</option><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label><label class="filter-field"><span class="sr-only">Filtrar por disponibilidade</span><select id="productAvailabilityFilter"><option value="">Disponibilidade</option><option value="available">Disponível</option><option value="unavailable">Indisponível</option></select></label><label class="filter-field"><span class="sr-only">Filtrar por promoção</span><select id="productPromotionFilter"><option value="">Promoção</option><option value="yes">Em promoção</option><option value="no">Sem promoção</option></select></label></div>
    <div class="table-scroll"><table class="products-table"><thead><tr><th scope="col">Imagem</th><th scope="col">Produto</th><th scope="col">Categoria</th><th scope="col">Preço</th><th scope="col">Preço promocional</th><th scope="col">Estoque</th><th scope="col">Status</th><th scope="col">Atualizado</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>${renderProductRows(visible)}</tbody></table></div>
    <footer class="table-footer"><span>${products.length ? `Exibindo ${start + 1}–${Math.min(start + state.pageSize, products.length)} de ${products.length} produtos` : '0 produtos'}</span><div class="pagination"><button class="icon-button" type="button" data-action="previous-page" aria-label="Página anterior" ${state.productPage <= 1 ? 'disabled' : ''}>‹</button><span>Página ${state.productPage} de ${pageCount}</span><button class="icon-button" type="button" data-action="next-page" aria-label="Próxima página" ${state.productPage >= pageCount ? 'disabled' : ''}>›</button></div></footer></section>`;
}

function renderCategories() {
  const categories = state.categories;
  const cards = categories.length ? categories.map((category) => {
    const productCount = state.products.filter((product) => Number(product.categoryId) === Number(category.id)).length;
    return `<article class="category-card"><span class="category-card-icon">${icon('tag')}</span><div class="category-card-info"><h3>${escapeHTML(category.name)}</h3><p>${productCount} ${productCount === 1 ? 'produto vinculado' : 'produtos vinculados'}</p></div><span class="status-pill ${category.status === 'inactive' ? 'status-muted' : 'status-success'}"><i></i>${category.status === 'inactive' ? 'Inativa' : 'Ativa'}</span><div class="category-card-actions"><button class="admin-button admin-button-quiet" type="button" data-action="edit-category" data-id="${Number(category.id)}">${icon('edit')} Editar</button><button class="icon-button icon-button-danger" type="button" data-action="delete-category" data-id="${Number(category.id)}" aria-label="Excluir categoria ${escapeHTML(category.name)}" title="Excluir">${icon('trash')}</button></div></article>`;
  }).join('') : `<div class="admin-empty-state category-empty"><span class="empty-symbol">${icon('tag')}</span><h3>Nenhuma categoria cadastrada</h3><p>Crie categorias para organizar os produtos e facilitar a navegação na loja.</p><button class="admin-button admin-button-primary" type="button" data-action="new-category">${icon('plus')} Criar primeira categoria</button></div>`;

  return `<section class="page-intro"><div><p class="admin-eyebrow">ORGANIZAÇÃO DO CATÁLOGO</p><h2>Categorias</h2><p>Agrupe seus produtos para deixar a loja mais fácil de navegar.</p></div><button class="admin-button admin-button-primary" type="button" data-action="new-category">${icon('plus')} Nova categoria</button></section><section class="category-grid">${cards}</section>`;
}

function settingField(label, name, value, placeholder = '', type = 'text', helper = '') {
  const control = type === 'textarea'
    ? `<textarea name="${name}" rows="3" placeholder="${escapeHTML(placeholder)}">${escapeHTML(value || '')}</textarea>`
    : `<input type="${type}" name="${name}" value="${escapeHTML(value || '')}" placeholder="${escapeHTML(placeholder)}" />`;
  return `<label class="field-label"><span>${label}</span>${control}${helper ? `<small>${helper}</small>` : ''}</label>`;
}

function toggleField(label, name, value, description) {
  const enabled = value === true || value === 1 || value === '1' || value === 'true';
  return `<label class="setting-toggle"><span class="setting-toggle-copy"><strong>${label}</strong><small>${description}</small></span><input type="checkbox" name="${name}" ${enabled ? 'checked' : ''} /><span class="toggle-track" aria-hidden="true"></span></label>`;
}

function renderSettings() {
  const settings = state.settings;
  return `<section class="page-intro"><div><p class="admin-eyebrow">PERSONALIZE SUA OPERAÇÃO</p><h2>Configurações da loja</h2><p>Atualize os dados e as opções que aparecem para seus clientes.</p></div></section>
    <form id="settingsForm" class="settings-form"><section class="admin-panel settings-panel"><header class="settings-panel-heading"><span class="settings-section-number">01</span><div><h3>Dados da loja</h3><p>Informações de identificação e contato da Domus.</p></div></header><div class="settings-fields settings-fields-two">${settingField('Nome da loja', 'storeName', settings.storeName, 'Domus Conveniência')}${settingField('WhatsApp para pedidos', 'whatsappNumber', settings.whatsappNumber, '5548999999999', 'tel', 'Inclua o código do país e o DDD, somente números.')}${settingField('Identificação da loja', 'businessLabel', settings.businessLabel, 'Nome e cidade')}${settingField('Localização exibida', 'locationLabel', settings.locationLabel, 'Bairro ou cidade')}${settingField('Endereço', 'address', settings.address, 'Rua, número, bairro e cidade', 'text')}${settingField('Informações de contato', 'contactInfo', settings.contactInfo, 'Canais e horários de atendimento', 'textarea')}</div></section>
    <section class="admin-panel settings-panel"><header class="settings-panel-heading"><span class="settings-section-number">02</span><div><h3>Pedidos pelo WhatsApp</h3><p>Defina a mensagem que acompanha os pedidos enviados à loja.</p></div></header><div class="settings-fields">${settingField('Mensagem inicial do pedido', 'whatsappMessage', settings.whatsappMessage, 'Olá! Gostaria de realizar um pedido...', 'textarea', 'Esta mensagem aparece quando o cliente continua o pedido pelo WhatsApp.')}</div></section>
    <section class="admin-panel settings-panel"><header class="settings-panel-heading"><span class="settings-section-number">03</span><div><h3>Entrega e retirada</h3><p>Escolha as formas de recebimento disponíveis na loja.</p></div></header><div class="settings-toggles">${toggleField('Delivery', 'deliveryEnabled', settings.deliveryEnabled, 'Permite que o cliente solicite entrega.')}${toggleField('Retirada no estabelecimento', 'pickupEnabled', settings.pickupEnabled, 'Permite que o cliente retire o pedido na loja.')}</div></section>
    <div class="settings-savebar"><span>As alterações são aplicadas à loja após salvar.</span><button class="admin-button admin-button-primary" type="submit">Salvar configurações</button></div></form>`;
}

function renderPage() {
  const title = pageNames[state.page] || pageNames.overview;
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('breadcrumb').innerHTML = `<span>Painel</span><span aria-hidden="true">/</span><strong>${escapeHTML(title)}</strong>`;
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.dataset.page === state.page;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const views = { overview: renderDashboard, products: renderProducts, categories: renderCategories, settings: renderSettings };
  document.getElementById('pageContent').innerHTML = views[state.page]();
}

function switchPage(page) {
  if (!pageNames[page]) return;
  state.page = page;
  state.productPage = 1;
  renderPage();
  closeSidebar();
  document.getElementById('pageContent').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openEditor(content) {
  const dialog = document.getElementById('editorDialog');
  document.getElementById('editorContent').innerHTML = content;
  dialog.showModal();
}

function closeEditor() {
  const dialog = document.getElementById('editorDialog');
  if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
  state.imagePreviewUrl = null;
  dialog.close();
}

function productFormMarkup(product = null) {
  const editing = Boolean(product);
  const categoryOptions = state.categories.map((category) => `<option value="${Number(category.id)}" ${Number(product?.categoryId) === Number(category.id) ? 'selected' : ''}>${escapeHTML(category.name)}${category.status === 'inactive' ? ' (inativa)' : ''}</option>`).join('');
  const preview = imageSource(product?.image);
  return `<form id="productForm" class="editor-form">
    <header class="dialog-header"><div><p class="admin-eyebrow">${editing ? 'ATUALIZE O CATÁLOGO' : 'NOVO ITEM NO CATÁLOGO'}</p><h2>${editing ? 'Editar produto' : 'Cadastrar produto'}</h2><p>Preencha as informações do produto para exibi-lo na loja.</p></div><button class="icon-button" type="button" data-action="close-editor" aria-label="Fechar">${icon('close')}</button></header>
    <input type="hidden" name="productId" value="${editing ? Number(product.id) : ''}" />
    <div class="product-editor-grid"><div class="editor-main-column">
      <section class="editor-section"><header><span>01</span><div><h3>Informações básicas</h3><p>Identifique o produto e onde ele aparece.</p></div></header><div class="editor-fields"><label class="field-label"><span>Nome do produto <i>*</i></span><input name="name" type="text" maxlength="120" value="${escapeHTML(product?.name || '')}" placeholder="Ex.: Refrigerante 2 litros" required /></label><label class="field-label"><span>Categoria <i>*</i></span><select name="categoryId" required ${state.categories.length ? '' : 'disabled'}><option value="">${state.categories.length ? 'Selecione uma categoria' : 'Cadastre uma categoria primeiro'}</option>${categoryOptions}</select></label><label class="field-label field-span-two"><span>Descrição</span><textarea name="description" rows="3" maxlength="500" placeholder="Informações que ajudam o cliente a escolher">${escapeHTML(product?.description || '')}</textarea></label><label class="field-label"><span>Unidade de venda</span><input name="unit" type="text" maxlength="40" value="${escapeHTML(product?.unit || 'unidade')}" placeholder="unidade, kg, pacote..." /></label></div></section>
      <section class="editor-section"><header><span>02</span><div><h3>Preço e estoque</h3><p>Valores e quantidade disponíveis para venda.</p></div></header><div class="editor-fields editor-fields-three"><label class="field-label"><span>Preço normal <i>*</i></span><div class="input-with-prefix"><span>R$</span><input name="price" type="number" min="0.01" max="999999.99" step="0.01" value="${product ? Number(product.price) : ''}" placeholder="0,00" required /></div></label><label class="field-label"><span>Preço promocional</span><div class="input-with-prefix"><span>R$</span><input name="promotionalPrice" type="number" min="0.01" step="0.01" value="${product?.promotionalPrice ? Number(product.promotionalPrice) : ''}" placeholder="Opcional" /></div><small>Deve ser menor que o preço normal.</small></label><label class="field-label"><span>Quantidade em estoque</span><input name="stock" type="number" min="0" max="1000000" step="1" value="${editing ? Number(product.stock) : 0}" required /><small>Unidades disponíveis para venda.</small></label></div></section>
      <section class="editor-section"><header><span>03</span><div><h3>Imagem do produto</h3><p>Use uma imagem clara para apresentar o item.</p></div></header><div class="image-upload-block"><label id="imageDropZone" class="image-drop-zone" for="productImage"><input id="productImage" name="productImage" type="file" accept="image/*" /><span id="imagePreview" class="image-preview">${preview ? `<img src="${escapeHTML(preview)}" alt="Prévia do produto" />` : icon('image')}</span><span class="upload-copy"><strong>Arraste uma imagem ou <u>selecione um arquivo</u></strong><small>Imagens até 5 MB. Formatos aceitos pelo navegador.</small></span></label><div class="image-url-field"><label class="field-label"><span>Ou informe uma URL segura</span><input id="productImageUrl" name="image" type="text" inputmode="url" maxlength="2048" value="${escapeHTML(product?.image || '')}" placeholder="https://... ou /uploads/..." /></label><button class="admin-button admin-button-quiet" type="button" data-action="remove-image">Remover imagem</button></div></div></section>
    </div><aside class="editor-side-column"><section class="editor-section display-section"><header><span>04</span><div><h3>Exibição na loja</h3><p>Controle como o produto aparece para o cliente.</p></div></header><div class="editor-toggles">${toggleField('Produto ativo', 'status', product?.status !== 'inactive', 'Produtos inativos não aparecem no catálogo.')}${toggleField('Disponível para venda', 'available', product ? product.available : true, 'Marque indisponível quando não houver o item.')}${toggleField('Produto em destaque', 'featured', Boolean(product?.featured), 'Dá mais visibilidade na vitrine.')}${toggleField('Em promoção', 'promotion', Boolean(product?.promotion), 'Identifica o item como oferta.')}</div></section><div class="editor-note"><span aria-hidden="true">i</span><p>Os campos marcados com <i>*</i> são obrigatórios. As alterações atualizam o catálogo da loja.</p></div></aside></div>
    <footer class="dialog-actions"><button class="admin-button admin-button-secondary" type="button" data-action="close-editor">Cancelar</button><button class="admin-button admin-button-primary" type="submit" ${state.categories.length ? '' : 'disabled'}>Salvar produto</button></footer>
  </form>`;
}

function openProductEditor(product = null) {
  openEditor(productFormMarkup(product));
  const form = document.getElementById('productForm');
  const fileInput = form.elements.productImage;
  const urlInput = form.elements.image;
  const preview = document.getElementById('imagePreview');
  const dropZone = document.getElementById('imageDropZone');
  const setPreview = (source) => {
    preview.innerHTML = source ? `<img src="${escapeHTML(source)}" alt="Prévia do produto" />` : icon('image');
  };
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      fileInput.value = '';
      showToast(file.size > 5 * 1024 * 1024 ? 'A imagem deve ter no máximo 5 MB.' : 'Selecione um arquivo de imagem válido.', 'error');
      return;
    }
    if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = URL.createObjectURL(file);
    setPreview(state.imagePreviewUrl);
    urlInput.value = '';
  });
  urlInput.addEventListener('input', () => {
    if (!fileInput.files.length) setPreview(imageSource(urlInput.value));
  });
  ['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  }));
  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  form.elements.name.focus();
}

function openCategoryEditor(category = null) {
  const editing = Boolean(category);
  openEditor(`<form id="categoryForm" class="category-editor-form"><header class="dialog-header"><div><p class="admin-eyebrow">ORGANIZAÇÃO DO CATÁLOGO</p><h2>${editing ? 'Editar categoria' : 'Nova categoria'}</h2><p>As categorias ajudam seus clientes a encontrar produtos.</p></div><button class="icon-button" type="button" data-action="close-editor" aria-label="Fechar">${icon('close')}</button></header><input type="hidden" name="categoryId" value="${editing ? Number(category.id) : ''}" /><label class="field-label"><span>Nome da categoria <i>*</i></span><input name="categoryName" type="text" maxlength="80" value="${escapeHTML(category?.name || '')}" placeholder="Ex.: Bebidas" required /></label><label class="field-label"><span>Status da categoria</span><select name="categoryStatus"><option value="active" ${category?.status !== 'inactive' ? 'selected' : ''}>Ativa</option><option value="inactive" ${category?.status === 'inactive' ? 'selected' : ''}>Inativa</option></select><small>Categorias inativas não aparecem na loja pública.</small></label><footer class="dialog-actions"><button class="admin-button admin-button-secondary" type="button" data-action="close-editor">Cancelar</button><button class="admin-button admin-button-primary" type="submit">Salvar categoria</button></footer></form>`);
  document.querySelector('#categoryForm [name="categoryName"]').focus();
}

async function confirmDestructive(title, message, buttonLabel) {
  const dialog = document.getElementById('confirmDialog');
  document.getElementById('confirmContent').innerHTML = `<div class="confirm-content"><span class="confirm-icon">${icon('trash')}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p><div class="dialog-actions"><button class="admin-button admin-button-secondary" type="button" data-action="cancel-confirm">Cancelar</button><button class="admin-button admin-button-danger" type="button" data-action="accept-confirm">${escapeHTML(buttonLabel)}</button></div></div>`;
  dialog.showModal();
  return new Promise((resolve) => {
    state.confirmAction = resolve;
  });
}

async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const payload = await requestJSON('/api/admin/upload', { method: 'POST', body: formData });
  return payload.imageUrl || '';
}

function productPayload(form, image) {
  return {
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim(),
    categoryId: form.elements.categoryId.value,
    price: form.elements.price.value,
    promotionalPrice: form.elements.promotionalPrice.value,
    image,
    stock: form.elements.stock.value,
    unit: form.elements.unit.value.trim() || 'unidade',
    status: form.elements.status.checked ? 'active' : 'inactive',
    available: form.elements.available.checked,
    featured: form.elements.featured.checked,
    promotion: form.elements.promotion.checked,
  };
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const productId = form.elements.productId.value;
  const file = form.elements.productImage.files[0];
  const price = Number(form.elements.price.value);
  const promo = form.elements.promotionalPrice.value ? Number(form.elements.promotionalPrice.value) : null;
  if (promo !== null && (!Number.isFinite(promo) || promo >= price)) {
    form.elements.promotionalPrice.setCustomValidity('O preço promocional deve ser menor que o preço normal.');
    form.elements.promotionalPrice.reportValidity();
    form.elements.promotionalPrice.addEventListener('input', () => form.elements.promotionalPrice.setCustomValidity(''), { once: true });
    return;
  }
  setBusy(submitButton, true, 'Salvando produto...');
  try {
    let image = form.elements.image.value.trim();
    if (file) image = await uploadProductImage(file);
    const payload = productPayload(form, image);
    await requestJSON(productId ? `/api/admin/products/${productId}` : '/api/admin/products', {
      method: productId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    closeEditor();
    await loadAll();
    showToast(productId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar o produto.', 'error');
    setBusy(submitButton, false);
  }
}

async function saveCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const id = form.elements.categoryId.value;
  setBusy(submitButton, true, 'Salvando...');
  try {
    await requestJSON(id ? `/api/admin/categories/${id}` : '/api/admin/categories', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.elements.categoryName.value.trim(), status: form.elements.categoryStatus.value }),
    });
    closeEditor();
    await loadAll();
    showToast(id ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar a categoria.', 'error');
    setBusy(submitButton, false);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  setBusy(submitButton, true, 'Salvando configurações...');
  const payload = {
    storeName: form.elements.storeName.value.trim(),
    whatsappNumber: form.elements.whatsappNumber.value.trim(),
    whatsappMessage: form.elements.whatsappMessage.value.trim(),
    businessLabel: form.elements.businessLabel.value.trim(),
    locationLabel: form.elements.locationLabel.value.trim(),
    address: form.elements.address.value.trim(),
    contactInfo: form.elements.contactInfo.value.trim(),
    deliveryEnabled: form.elements.deliveryEnabled.checked,
    pickupEnabled: form.elements.pickupEnabled.checked,
  };
  try {
    await requestJSON('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    state.settings = { ...state.settings, ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, typeof value === 'boolean' ? String(Number(value)) : value])) };
    updateStoreIdentity();
    showToast('Configurações salvas com sucesso.');
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar as configurações.', 'error');
  } finally {
    setBusy(submitButton, false);
  }
}

async function deleteProduct(product) {
  const confirmed = await confirmDestructive('Excluir produto?', `O produto “${product.name}” será removido permanentemente do catálogo.`, 'Excluir produto');
  if (!confirmed) return;
  try {
    await requestJSON(`/api/admin/products/${Number(product.id)}`, { method: 'DELETE' });
    await loadAll();
    showToast('Produto excluído com sucesso.');
  } catch (error) {
    showToast(error.message || 'Não foi possível excluir o produto.', 'error');
  }
}

async function deleteCategory(category) {
  const linkedProducts = state.products.filter((product) => Number(product.categoryId) === Number(category.id)).length;
  if (linkedProducts) {
    showToast(`Esta categoria tem ${linkedProducts} ${linkedProducts === 1 ? 'produto vinculado' : 'produtos vinculados'}. Mova ou remova ${linkedProducts === 1 ? 'o produto' : 'os produtos'} antes de excluí-la.`, 'error');
    return;
  }
  const confirmed = await confirmDestructive('Excluir categoria?', `A categoria “${category.name}” será removida.`, 'Excluir categoria');
  if (!confirmed) return;
  try {
    await requestJSON(`/api/admin/categories/${Number(category.id)}`, { method: 'DELETE' });
    await loadAll();
    showToast('Categoria excluída com sucesso.');
  } catch (error) {
    showToast(error.message || 'Não foi possível excluir a categoria.', 'error');
  }
}

async function toggleProduct(product) {
  const payload = {
    name: product.name,
    description: product.description || '',
    categoryId: product.categoryId || '',
    price: product.price,
    promotionalPrice: product.promotionalPrice ?? '',
    image: product.image || '',
    stock: product.stock,
    unit: product.unit || 'unidade',
    status: product.status === 'active' ? 'inactive' : 'active',
    available: product.available,
    featured: product.featured,
    promotion: product.promotion,
  };
  try {
    await requestJSON(`/api/admin/products/${Number(product.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    await loadAll();
    showToast(product.status === 'active' ? 'Produto desativado.' : 'Produto ativado.');
  } catch (error) {
    showToast(error.message || 'Não foi possível atualizar o produto.', 'error');
  }
}

function handlePageAction(event) {
  const button = event.target.closest('[data-page], [data-action]');
  if (!button) return;
  if (button.dataset.page) {
    switchPage(button.dataset.page);
    return;
  }
  const action = button.dataset.action;
  if (action === 'new-product') openProductEditor();
  if (action === 'new-category') openCategoryEditor();
  if (action === 'edit-product') openProductEditor(state.products.find((product) => Number(product.id) === Number(button.dataset.id)));
  if (action === 'edit-category') openCategoryEditor(state.categories.find((category) => Number(category.id) === Number(button.dataset.id)));
  if (action === 'delete-product') {
    const product = state.products.find((item) => Number(item.id) === Number(button.dataset.id));
    if (product) deleteProduct(product);
  }
  if (action === 'delete-category') {
    const category = state.categories.find((item) => Number(item.id) === Number(button.dataset.id));
    if (category) deleteCategory(category);
  }
  if (action === 'toggle-product') {
    const product = state.products.find((item) => Number(item.id) === Number(button.dataset.id));
    if (product) toggleProduct(product);
  }
  if (action === 'close-editor') closeEditor();
  if (action === 'remove-image') {
    const form = document.getElementById('productForm');
    if (!form) return;
    form.elements.image.value = '';
    form.elements.productImage.value = '';
    if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = null;
    document.getElementById('imagePreview').innerHTML = icon('image');
  }
  if (action === 'clear-filters') {
    state.productQuery = '';
    state.productCategory = '';
    state.productStatus = '';
    state.productAvailability = '';
    state.productPromotion = '';
    state.productPage = 1;
    renderPage();
  }
  if (action === 'previous-page' && state.productPage > 1) { state.productPage -= 1; renderPage(); }
  if (action === 'next-page') { state.productPage += 1; renderPage(); }
  if (action === 'reload') loadAll();
  if (action === 'cancel-confirm' || action === 'accept-confirm') {
    const resolve = state.confirmAction;
    state.confirmAction = null;
    document.getElementById('confirmDialog').close();
    resolve?.(action === 'accept-confirm');
  }
}

function closeSidebar() {
  document.getElementById('adminSidebar').classList.remove('is-open');
  document.getElementById('sidebarBackdrop').classList.remove('is-visible');
  document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  setBusy(button, true, 'Entrando...');
  try {
    await requestJSON('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.elements.email.value.trim(), password: form.elements.password.value }),
    });
    form.reset();
    await checkAuth();
  } catch (error) {
    showToast(error.message || 'Não foi possível entrar no painel.', 'error');
  } finally {
    setBusy(button, false);
  }
}

async function logout() {
  const button = document.getElementById('logoutBtn');
  button.disabled = true;
  try {
    await requestJSON('/api/admin/logout', { method: 'POST' });
    state.isAuthenticated = false;
    state.user = null;
    showView(false);
    showToast('Você saiu do painel.');
  } catch (error) {
    showToast(error.message || 'Não foi possível sair do painel.', 'error');
  } finally {
    button.disabled = false;
  }
}

function attachEvents() {
  document.getElementById('loginForm').addEventListener('submit', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('pageContent').addEventListener('click', handlePageAction);
  document.getElementById('adminSidebar').addEventListener('click', (event) => {
    const item = event.target.closest('[data-page]');
    if (item) switchPage(item.dataset.page);
  });
  document.getElementById('menuToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('adminSidebar');
    const open = !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', open);
    document.getElementById('sidebarBackdrop').classList.toggle('is-visible', open);
    document.getElementById('menuToggle').setAttribute('aria-expanded', String(open));
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);
  document.getElementById('editorContent').addEventListener('click', handlePageAction);
  document.getElementById('editorContent').addEventListener('submit', (event) => {
    if (event.target.id === 'productForm') saveProduct(event);
    if (event.target.id === 'categoryForm') saveCategory(event);
  });
  document.getElementById('confirmContent').addEventListener('click', handlePageAction);
  document.getElementById('pageContent').addEventListener('input', (event) => {
    if (event.target.id !== 'productSearch') return;
    const position = event.target.selectionStart;
    state.productQuery = event.target.value;
    state.productPage = 1;
    renderPage();
    const search = document.getElementById('productSearch');
    search.focus();
    search.setSelectionRange(position, position);
  });
  document.getElementById('pageContent').addEventListener('change', (event) => {
    const filters = {
      productCategoryFilter: 'productCategory',
      productStatusFilter: 'productStatus',
      productAvailabilityFilter: 'productAvailability',
      productPromotionFilter: 'productPromotion',
    };
    const key = filters[event.target.id];
    if (!key) return;
    state[key] = event.target.value;
    state.productPage = 1;
    renderPage();
  });
  document.getElementById('pageContent').addEventListener('submit', (event) => {
    if (event.target.id === 'settingsForm') saveSettings(event);
  });
  document.getElementById('editorDialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeEditor();
  });
  document.getElementById('confirmDialog').addEventListener('click', (event) => {
    if (event.target !== event.currentTarget) return;
    document.getElementById('confirmDialog').close();
    const resolve = state.confirmAction;
    state.confirmAction = null;
    resolve?.(false);
  });
  document.getElementById('confirmDialog').addEventListener('close', () => {
    const resolve = state.confirmAction;
    state.confirmAction = null;
    resolve?.(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  checkAuth();
});
