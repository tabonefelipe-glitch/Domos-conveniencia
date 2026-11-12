const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const envPath = path.join(__dirname, '.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD)) {
  throw new Error('Configure SESSION_SECRET e ADMIN_PASSWORD no ambiente de produção.');
}

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const PORT = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const uploadsDir = path.join(rootDir, 'uploads');
const dbPath = path.join(rootDir, 'data', 'domus.db');
const usePostgres = Boolean(process.env.DATABASE_URL);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = usePostgres
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : new sqlite3.Database(dbPath);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  }
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use('/data', (_req, res) => res.sendStatus(404));
app.use(express.static(rootDir));
app.use(session({
  secret: process.env.SESSION_SECRET || 'domus-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

function parseBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes';
}

function validateProductPayload(input) {
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const price = Number(input.price);
  const promotionalPrice = input.promotionalPrice === '' || input.promotionalPrice === null || input.promotionalPrice === undefined
    ? null
    : Number(input.promotionalPrice);
  const categoryId = input.categoryId === '' || input.categoryId === null || input.categoryId === undefined
    ? null
    : Number(input.categoryId);
  const image = String(input.image || '').trim();
  const status = input.status || 'active';
  const unit = String(input.unit || 'unidade').trim();

  if (!name || name.length > 120) return { error: 'Informe um nome com até 120 caracteres.' };
  if (description.length > 500) return { error: 'A descrição deve ter até 500 caracteres.' };
  if (!Number.isFinite(price) || price <= 0 || price > 999999.99) return { error: 'O preço do produto é inválido.' };
  if (promotionalPrice !== null && (!Number.isFinite(promotionalPrice) || promotionalPrice <= 0 || promotionalPrice >= price)) {
    return { error: 'O preço promocional deve ser positivo e menor que o preço normal.' };
  }
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) return { error: 'A categoria selecionada é inválida.' };
  if (unit.length > 40) return { error: 'A unidade deve ter até 40 caracteres.' };
  if (image.length > 2048 || (image && !/^https:\/\//i.test(image) && !/^\/(uploads|assets\/images)\//i.test(image))) {
    return { error: 'Informe uma URL HTTPS ou uma imagem enviada para a loja.' };
  }
  if (!['active', 'inactive'].includes(status)) return { error: 'O status do produto é inválido.' };

  return {
    product: {
      name,
      description,
      categoryId,
      price,
      promotionalPrice,
      image,
      unit: unit || 'unidade',
      status,
      available: parseBoolean(input.available) ? 1 : 0,
      featured: parseBoolean(input.featured) ? 1 : 0,
      promotion: parseBoolean(input.promotion) ? 1 : 0
    }
  };
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.category_id,
    categoryName: product.category_name,
    price: Number(product.price || 0),
    promotionalPrice: product.promotional_price !== null && product.promotional_price !== undefined
      ? Number(product.promotional_price)
      : null,
    image: product.image || '',
    unit: product.unit || 'unidade',
    status: product.status || 'active',
    available: parseBoolean(product.available),
    featured: parseBoolean(product.featured),
    promotion: parseBoolean(product.promotion),
    createdAt: product.created_at,
    updatedAt: product.updated_at
  };
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Autenticação necessária.' });
  }
  next();
}

function logAdminAuth(event, req, details = {}) {
  const cookies = String(req.headers.cookie || '').split(';');
  const hasSessionCookie = cookies.some((cookie) => cookie.trim().startsWith('connect.sid='));
  console.info(JSON.stringify({
    scope: 'admin-auth',
    event,
    database: usePostgres ? 'postgres' : 'sqlite',
    secureRequest: req.secure,
    forwardedProto: req.get('x-forwarded-proto') || null,
    trustProxy: app.get('trust proxy'),
    hasSessionCookie,
    ...details
  }));
}

function normalizePostgresSql(sql, params) {
  let normalizedSql = sql;

  if (normalizedSql.includes('?')) {
    let paramIndex = 0;
    normalizedSql = normalizedSql.replace(/\?/g, () => {
      paramIndex += 1;
      return `$${paramIndex}`;
    });
  }

  if (normalizedSql.toUpperCase().includes('INSERT OR IGNORE INTO')) {
    normalizedSql = normalizedSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (normalizedSql.toUpperCase().includes('CATEGORIES')) {
      normalizedSql = normalizedSql.replace(/VALUES\s*\(\s*\$1\s*,\s*'active'\s*\)/i, 'VALUES ($1, $2) ON CONFLICT (name) DO NOTHING');
      normalizedSql = normalizedSql.replace(/VALUES\s*\(\s*\$1\s*,\s*\$2\s*\)/i, 'VALUES ($1, $2) ON CONFLICT (name) DO NOTHING');
    }
    if (normalizedSql.toUpperCase().includes('STORE_SETTINGS')) {
      normalizedSql = normalizedSql.replace(/VALUES\s*\(\s*\$1\s*,\s*\$2\s*\)/i, 'VALUES ($1, $2) ON CONFLICT (key) DO NOTHING');
    }
  }

  if (normalizedSql.toUpperCase().includes('INSERT INTO') && !normalizedSql.toUpperCase().includes('RETURNING') && !normalizedSql.toUpperCase().includes('ON CONFLICT')) {
    normalizedSql = `${normalizedSql} RETURNING id`;
  }

  return { sql: normalizedSql, params };
}

function dbRun(sql, params = []) {
  if (usePostgres) {
    const prepared = normalizePostgresSql(sql, params);
    return new Promise((resolve, reject) => {
      db.query(prepared.sql, prepared.params)
        .then((result) => resolve({ id: result.rows?.[0]?.id ?? null, changes: result.rowCount ?? 0 }))
        .catch(reject);
    });
  }

  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  if (usePostgres) {
    const prepared = normalizePostgresSql(sql, params);
    return new Promise((resolve, reject) => {
      db.query(prepared.sql, prepared.params)
        .then((result) => resolve(result.rows[0] || null))
        .catch(reject);
    });
  }

  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  if (usePostgres) {
    const prepared = normalizePostgresSql(sql, params);
    return new Promise((resolve, reject) => {
      db.query(prepared.sql, prepared.params)
        .then((result) => resolve(result.rows || []))
        .catch(reject);
    });
  }

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function initializeDatabase() {
  if (usePostgres) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER,
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        promotional_price NUMERIC(10,2),
        image TEXT,
        stock INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'unidade',
        status TEXT NOT NULL DEFAULT 'active',
        available BOOLEAN NOT NULL DEFAULT TRUE,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        promotion BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  } else {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER,
        price REAL NOT NULL DEFAULT 0,
        promotional_price REAL,
        image TEXT,
        stock INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'unidade',
        status TEXT NOT NULL DEFAULT 'active',
        available INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        promotion INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS store_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  const defaultEmail = process.env.ADMIN_EMAIL || 'admin@domus.com';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'domus123';
  const adminExists = await dbGet('SELECT id, password_hash FROM admin_users WHERE email = ?', [defaultEmail]);

  if (!adminExists) {
    const hash = await bcrypt.hash(defaultPassword, 10);
    if (usePostgres) {
      await dbRun('INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', ['Administrador', defaultEmail, hash]);
    } else {
      await dbRun('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)', ['Administrador', defaultEmail, hash]);
    }
  } else if (process.env.ADMIN_PASSWORD && !(await bcrypt.compare(process.env.ADMIN_PASSWORD, adminExists.password_hash))) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await dbRun('UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, adminExists.id]);
  }

  const seedCategories = [
    'Bebidas',
    'Cervejas',
    'Destilados',
    'Refrigerantes',
    'Produtos para churrasco',
    'Salgados e lanches',
    'Congelados',
    'Doces e snacks',
    'Mercearia',
    'Outros'
  ];

  for (const categoryName of seedCategories) {
    if (usePostgres) {
      await dbRun('INSERT INTO categories (name, status) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [categoryName, 'active']);
    } else {
      await dbRun(`INSERT OR IGNORE INTO categories (name, status) VALUES (?, 'active')`, [categoryName]);
    }
  }

  const settingsMap = {
    storeName: process.env.STORE_NAME || 'DOMUS CONVENIÊNCIA',
    whatsappNumber: process.env.WHATSAPP_NUMBER || '554885003330',
    whatsappMessage: 'Olá! Gostaria de realizar um pedido na Domus Conveniência.',
    businessLabel: 'DOMUS CONVENIÊNCIA | CAMPINAS, SÃO JOSÉ - SC',
    locationLabel: 'Campinas, São José - SC',
    address: 'R. Quinze de Novembro, 150 - Sl 21 - Campinas, São José - SC, 88101-440',
    contactInfo: 'Contato via WhatsApp e Instagram',
    deliveryEnabled: '1',
    pickupEnabled: '1'
  };

  for (const [key, value] of Object.entries(settingsMap)) {
    if (usePostgres) {
      await dbRun('INSERT INTO store_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(value)]);
    } else {
      await dbRun(`INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)`, [key, String(value)]);
    }
  }

}

async function getSettings() {
  const rows = await dbAll('SELECT key, value FROM store_settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function getActiveCategories() {
  const rows = await dbAll('SELECT * FROM categories WHERE status = ? ORDER BY name ASC', ['active']);
  return rows.map((row) => ({ id: row.id, name: row.name, status: row.status }));
}

async function getDashboardStats() {
  const rows = await dbAll(`
    SELECT
      (SELECT COUNT(*) FROM products) AS totalProducts,
      (SELECT COUNT(*) FROM products WHERE status = 'active') AS activeProducts,
      (SELECT COUNT(*) FROM products WHERE available = FALSE OR status = 'inactive') AS unavailableProducts,
      (SELECT COUNT(*) FROM products WHERE promotion = TRUE) AS promoProducts,
      (SELECT COUNT(*) FROM categories) AS totalCategories
  `);

  return rows[0] || { totalProducts: 0, activeProducts: 0, unavailableProducts: 0, promoProducts: 0, totalCategories: 0 };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Domus Conveniência API' });
});

app.get('/api/store/settings', async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      companyName: settings.storeName || 'DOMUS CONVENIÊNCIA',
      businessLabel: settings.businessLabel || 'DOMUS CONVENIÊNCIA | CAMPINAS, SÃO JOSÉ - SC',
      locationLabel: settings.locationLabel || 'Campinas, São José - SC',
      address: settings.address || '',
      whatsappNumber: settings.whatsappNumber || '',
      whatsappMessage: settings.whatsappMessage || 'Olá! Gostaria de realizar um pedido na Domus Conveniência.',
      deliveryEnabled: parseBoolean(settings.deliveryEnabled),
      pickupEnabled: parseBoolean(settings.pickupEnabled),
      contactInfo: settings.contactInfo || '',
      instagramUrl: 'https://www.instagram.com/domusconveniencia.ofic/',
      mapsUrl: 'https://www.google.com/maps/place/Domus+conveni%C3%AAncia/@-27.5978249,-48.6068827,17z/data=!3m1!4b1!4m6!3m5!1s0x952737da655f590d:0x59d4eefe6db66bfc!8m2!3d-27.5978249!4d-48.6068827!16s%2Fg%2F11zbk43z6d?entry=ttu'
    });
  } catch (error) {
    console.error('Falha ao carregar configurações públicas da loja:', error);
    res.status(500).json({ message: 'Não foi possível carregar as configurações da loja.' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const categories = await getActiveCategories();
    res.json(categories);
  } catch (error) {
    console.error('Falha ao carregar categorias públicas:', error);
    res.status(500).json({ message: 'Não foi possível carregar as categorias.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const { search = '', category, sort = 'featured' } = req.query;
    const params = [];
    let query = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active' AND (c.id IS NULL OR c.status = 'active')
    `;

    if (category && category !== 'all') {
      const categoryId = Number(category);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ message: 'Categoria inválida.' });
      }
      query += ' AND p.category_id = ? AND c.status = ?';
      params.push(categoryId, 'active');
    }

    const products = (await dbAll(query, params)).map(formatProduct);
    const normalizedSearch = normalizeSearch(search);
    const filtered = normalizedSearch
      ? products.filter((product) => normalizeSearch(product.name).includes(normalizedSearch))
      : products;
    const priceForSort = (product) => product.promotion && Number(product.promotionalPrice) > 0
      ? Number(product.promotionalPrice)
      : Number(product.price);

    if (sort === 'price_asc') {
      filtered.sort((a, b) => priceForSort(a) - priceForSort(b));
    } else if (sort === 'price_desc') {
      filtered.sort((a, b) => priceForSort(b) - priceForSort(a));
    } else if (sort === 'name_asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    } else {
      filtered.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.promotion) - Number(a.promotion));
    }

    res.json(filtered);
  } catch (error) {
    console.error('Falha ao carregar produtos públicos:', error);
    res.status(500).json({ message: 'Não foi possível carregar os produtos.' });
  }
});

app.post('/api/orders/validate', async (req, res) => {
  try {
    const requestedItems = req.body?.items;
    if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 50) {
      return res.status(400).json({ message: 'O carrinho está vazio ou contém itens demais.' });
    }

    const quantities = new Map();
    for (const item of requestedItems) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Há um item inválido no carrinho.' });
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await dbAll(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id IN (${placeholders})
    `, ids);
    const products = new Map(rows.map((row) => [Number(row.id), formatProduct(row)]));
    const orderItems = [];
    let subtotalCents = 0;

    for (const [productId, quantity] of quantities) {
      const product = products.get(productId);
      if (!product || product.status !== 'active' || !product.available) {
        return res.status(409).json({
          message: `"${product?.name || 'Um produto'}" está indisponível. Atualize o carrinho.`,
          productId
        });
      }

      const unitPrice = product.promotion && Number(product.promotionalPrice) > 0
        ? Number(product.promotionalPrice)
        : Number(product.price);
      const unitPriceCents = Math.round(unitPrice * 100);
      const lineTotalCents = unitPriceCents * quantity;
      subtotalCents += lineTotalCents;
      orderItems.push({
        product: { id: product.id, name: product.name, unit: product.unit },
        quantity,
        unitPrice: unitPriceCents / 100,
        lineTotal: lineTotalCents / 100
      });
    }

    res.json({ items: orderItems, subtotal: subtotalCents / 100, total: subtotalCents / 100, deliveryFee: null });
  } catch (error) {
    res.status(500).json({ message: 'Não foi possível validar os itens do pedido.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await dbGet(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `, [Number(req.params.id)]);

    if (!row) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    res.json(formatProduct(row));
  } catch (error) {
    console.error('Falha ao buscar produto:', error);
    res.status(500).json({ message: 'Erro ao buscar produto.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logAdminAuth('login_rejected', req, { reason: 'missing_credentials' });
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const submittedEmail = String(email).trim();
    const user = await dbGet('SELECT * FROM admin_users WHERE email = ?', [submittedEmail]);
    if (!user) {
      logAdminAuth('login_rejected', req, {
        reason: 'admin_user_not_found',
        matchesConfiguredAdmin: submittedEmail.toLowerCase() === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
      });
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password_hash);
    if (!passwordMatches) {
      logAdminAuth('login_rejected', req, {
        reason: 'password_mismatch',
        matchesConfiguredAdmin: submittedEmail.toLowerCase() === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
      });
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    await new Promise((resolve, reject) => {
      req.session.save((error) => error ? reject(error) : resolve());
    });
    logAdminAuth('login_succeeded', req, { sessionSaved: true });
    res.json({ message: 'Login realizado com sucesso.', user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    logAdminAuth('login_error', req, { errorName: error.name, errorCode: error.code || null });
    res.status(500).json({ message: 'Erro ao tentar autenticar.' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado com sucesso.' });
  });
});

app.get('/api/admin/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    const cookies = String(req.headers.cookie || '').split(';');
    const hasSessionCookie = cookies.some((cookie) => cookie.trim().startsWith('connect.sid='));
    logAdminAuth('session_missing', req, {
      reason: hasSessionCookie ? 'session_cookie_not_found_in_store' : 'no_session_cookie'
    });
    return res.status(401).json({ authenticated: false });
  }

  logAdminAuth('session_authenticated', req);
  res.json({ authenticated: true, user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } });
});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Falha ao carregar dashboard:', error);
    res.status(500).json({ message: 'Erro ao carregar o dashboard.' });
  }
});

app.get('/api/admin/categories', requireAdmin, async (_req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
  } catch (error) {
    console.error('Falha ao carregar categorias administrativas:', error);
    res.status(500).json({ message: 'Erro ao carregar categorias.' });
  }
});

app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  try {
    const { name, status = 'active' } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    const categoryName = String(name).trim();
    const categoryStatus = status === 'inactive' ? 'inactive' : 'active';
    const existingCategory = await dbGet('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [categoryName]);
    if (existingCategory) {
      return res.status(409).json({ message: 'Já existe uma categoria com esse nome. Edite a categoria existente.' });
    }

    const result = await dbRun('INSERT INTO categories (name, status) VALUES (?, ?)', [categoryName, categoryStatus]);
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [result.id]);
    res.status(201).json(category);
  } catch (error) {
    console.error('Falha ao criar categoria:', error);
    res.status(500).json({ message: 'Erro ao criar categoria.' });
  }
});

app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, status = 'active' } = req.body;
    const categoryId = Number(req.params.id);
    const categoryName = String(name || '').trim();

    if (!categoryName) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    const existingCategory = await dbGet('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id <> ?', [categoryName, categoryId]);
    if (existingCategory) {
      return res.status(409).json({ message: 'Já existe outra categoria com esse nome.' });
    }

    await dbRun('UPDATE categories SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [categoryName, status === 'inactive' ? 'inactive' : 'active', categoryId]);
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [categoryId]);
    res.json(category);
  } catch (error) {
    console.error('Falha ao atualizar categoria:', error);
    res.status(500).json({ message: 'Erro ao atualizar categoria.' });
  }
});

app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const linkedProducts = await dbGet('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [categoryId]);

    if (Number(linkedProducts.total) > 0) {
      return res.status(400).json({ message: 'Não é possível excluir uma categoria com produtos vinculados.' });
    }

    await dbRun('DELETE FROM categories WHERE id = ?', [categoryId]);
    res.json({ message: 'Categoria removida com sucesso.' });
  } catch (error) {
    console.error('Falha ao remover categoria:', error);
    res.status(500).json({ message: 'Erro ao remover categoria.' });
  }
});

app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  try {
    const products = await dbAll(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.updated_at DESC
    `);

    res.json(products.map(formatProduct));
  } catch (error) {
    console.error('Falha ao carregar produtos administrativos:', error);
    res.status(500).json({ message: 'Erro ao carregar produtos.' });
  }
});

app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Selecione um arquivo de imagem válido.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const validation = validateProductPayload(req.body || {});
    if (validation.error) return res.status(400).json({ message: validation.error });
    const product = validation.product;
    if (product.categoryId && !(await dbGet('SELECT id FROM categories WHERE id = ?', [product.categoryId]))) {
      return res.status(400).json({ message: 'A categoria selecionada não existe.' });
    }

    const result = await dbRun(`
      INSERT INTO products (name, description, category_id, price, promotional_price, image, unit, status, available, featured, promotion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.name,
      product.description,
      product.categoryId,
      product.price,
      product.promotionalPrice,
      product.image,
      product.unit,
      product.status,
      product.available,
      product.featured,
      product.promotion
    ]);

    const created = await dbGet('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [result.id]);
    res.status(201).json(formatProduct(created));
  } catch (error) {
    console.error('Falha ao cadastrar produto:', error);
    res.status(500).json({ message: 'Erro ao cadastrar produto.' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ message: 'Produto inválido.' });
    const validation = validateProductPayload(req.body || {});
    if (validation.error) return res.status(400).json({ message: validation.error });
    const product = validation.product;
    if (product.categoryId && !(await dbGet('SELECT id FROM categories WHERE id = ?', [product.categoryId]))) {
      return res.status(400).json({ message: 'A categoria selecionada não existe.' });
    }

    await dbRun(`
      UPDATE products SET
        name = ?,
        description = ?,
        category_id = ?,
        price = ?,
        promotional_price = ?,
        image = ?,
        unit = ?,
        status = ?,
        available = ?,
        featured = ?,
        promotion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      product.name,
      product.description,
      product.categoryId,
      product.price,
      product.promotionalPrice,
      product.image,
      product.unit,
      product.status,
      product.available,
      product.featured,
      product.promotion,
      productId
    ]);

    const updated = await dbGet('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [productId]);
    res.json(formatProduct(updated));
  } catch (error) {
    console.error('Falha ao editar produto:', error);
    res.status(500).json({ message: 'Erro ao editar produto.' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    await dbRun('DELETE FROM products WHERE id = ?', [productId]);
    res.json({ message: 'Produto removido com sucesso.' });
  } catch (error) {
    console.error('Falha ao remover produto:', error);
    res.status(500).json({ message: 'Erro ao remover produto.' });
  }
});

app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Falha ao carregar configurações administrativas:', error);
    res.status(500).json({ message: 'Erro ao carregar configurações.' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const settings = req.body || {};
    const entries = [
      ['storeName', settings.storeName || 'DOMUS CONVENIÊNCIA'],
      ['whatsappNumber', settings.whatsappNumber || ''],
      ['whatsappMessage', settings.whatsappMessage || 'Olá! Gostaria de realizar um pedido na Domus Conveniência.'],
      ['businessLabel', settings.businessLabel || 'DOMUS CONVENIÊNCIA | CAMPINAS, SÃO JOSÉ - SC'],
      ['locationLabel', settings.locationLabel || 'Campinas, São José - SC'],
      ['address', settings.address || ''],
      ['contactInfo', settings.contactInfo || ''],
      ['deliveryEnabled', settings.deliveryEnabled ? '1' : '0'],
      ['pickupEnabled', settings.pickupEnabled ? '1' : '0']
    ];

    for (const [key, value] of entries) {
      await dbRun('INSERT INTO store_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
    }

    res.json({ message: 'Configurações salvas com sucesso.' });
  } catch (error) {
    console.error('Falha ao salvar configurações administrativas:', error);
    res.status(500).json({ message: 'Erro ao salvar configurações.' });
  }
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('/shop', (_req, res) => {
  res.sendFile(path.join(rootDir, 'shop.html'));
});

app.get('/loja', (_req, res) => {
  res.sendFile(path.join(rootDir, 'shop.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html')); 
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor ativo em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao inicializar o banco:', error);
    process.exit(1);
  });
