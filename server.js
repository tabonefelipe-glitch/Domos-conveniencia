const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
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
    image: product.image || '/assets/images/default-product.jpg',
    stock: Number(product.stock || 0),
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
  const adminExists = await dbGet('SELECT id FROM admin_users WHERE email = ?', [defaultEmail]);

  if (!adminExists) {
    const hash = await bcrypt.hash(defaultPassword, 10);
    if (usePostgres) {
      await dbRun('INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', ['Administrador', defaultEmail, hash]);
    } else {
      await dbRun('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)', ['Administrador', defaultEmail, hash]);
    }
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

  const existingProducts = await dbGet('SELECT id FROM products LIMIT 1');
  if (!existingProducts) {
    const categories = await dbAll('SELECT id, name FROM categories');
    const categoryIndex = Object.fromEntries(categories.map((category) => [category.name, category.id]));

    const sampleProducts = [
      {
        name: 'Coca-Cola 2L',
        description: 'Refrigerante de cola com sabor clássico para acompanhar qualquer refeição.',
        categoryId: categoryIndex['Refrigerantes'],
        price: 12.5,
        promotionalPrice: 10.9,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f2b0c1a9?auto=format&fit=crop&w=900&q=80',
        stock: 30,
        unit: 'unidade',
        available: 1,
        featured: 1,
        promotion: 1,
      },
      {
        name: 'Heineken 600ml',
        description: 'Cerveja lager premium, refrescante e equilibrada.',
        categoryId: categoryIndex['Cervejas'],
        price: 9.8,
        promotionalPrice: 8.5,
        image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80',
        stock: 24,
        unit: 'unidade',
        available: 1,
        featured: 1,
        promotion: 1,
      },
      {
        name: 'Carvão 3kg',
        description: 'Carvão para churrasco com boa queima e rendimento.',
        categoryId: categoryIndex['Produtos para churrasco'],
        price: 25,
        promotionalPrice: null,
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        stock: 16,
        unit: 'pacote',
        available: 1,
        featured: 0,
        promotion: 0,
      },
      {
        name: 'Pão de Queijo',
        description: 'Salgado quentinho e crocante para lanchar a qualquer hora.',
        categoryId: categoryIndex['Salgados e lanches'],
        price: 6.5,
        promotionalPrice: null,
        image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80',
        stock: 18,
        unit: 'unidade',
        available: 1,
        featured: 0,
        promotion: 0,
      },
      {
        name: 'Água Mineral 500ml',
        description: 'Água mineral sem gás para hidratação no dia a dia.',
        categoryId: categoryIndex['Bebidas'],
        price: 4.5,
        promotionalPrice: 3.9,
        image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
        stock: 40,
        unit: 'unidade',
        available: 1,
        featured: 0,
        promotion: 1,
      }
    ];

    for (const product of sampleProducts) {
      await dbRun(`
        INSERT INTO products (name, description, category_id, price, promotional_price, image, stock, unit, status, available, featured, promotion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `, [
        product.name,
        product.description,
        product.categoryId,
        product.price,
        product.promotionalPrice,
        product.image,
        product.stock,
        product.unit,
        product.available,
        product.featured,
        product.promotion
      ]);
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
      (SELECT COUNT(*) FROM products WHERE available = 0 OR status = 'inactive') AS unavailableProducts,
      (SELECT COUNT(*) FROM products WHERE promotion = 1) AS promoProducts,
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
    res.status(500).json({ message: 'Não foi possível carregar as configurações da loja.', error: error.message });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const categories = await getActiveCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Não foi possível carregar as categorias.', error: error.message });
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
      WHERE p.status = 'active'
    `;

    if (search && String(search).trim()) {
      query += ' AND LOWER(p.name) LIKE LOWER(?)';
      params.push(`%${String(search).trim()}%`);
    }

    if (category && category !== 'all') {
      query += ' AND p.category_id = ?';
      params.push(Number(category));
    }

    if (sort === 'price_asc') {
      query += ' ORDER BY COALESCE(p.promotional_price, p.price) ASC';
    } else if (sort === 'price_desc') {
      query += ' ORDER BY COALESCE(p.promotional_price, p.price) DESC';
    } else if (sort === 'name_asc') {
      query += ' ORDER BY p.name ASC';
    } else {
      query += ' ORDER BY p.featured DESC, p.promotion DESC, p.created_at DESC';
    }

    const rows = await dbAll(query, params);
    res.json(rows.map(formatProduct));
  } catch (error) {
    res.status(500).json({ message: 'Não foi possível carregar os produtos.', error: error.message });
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
    res.status(500).json({ message: 'Erro ao buscar produto.', error: error.message });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const user = await dbGet('SELECT * FROM admin_users WHERE email = ?', [String(email).trim()]);
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    res.json({ message: 'Login realizado com sucesso.', user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao tentar autenticar.', error: error.message });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado com sucesso.' });
  });
});

app.get('/api/admin/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({ authenticated: true, user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } });
});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar o dashboard.', error: error.message });
  }
});

app.get('/api/admin/categories', requireAdmin, async (_req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar categorias.', error: error.message });
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
    const result = await dbRun('INSERT INTO categories (name, status) VALUES (?, ?)', [categoryName, categoryStatus]);
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [result.id]);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar categoria.', error: error.message });
  }
});

app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, status = 'active' } = req.body;
    const categoryId = Number(req.params.id);

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    await dbRun('UPDATE categories SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [String(name).trim(), status === 'inactive' ? 'inactive' : 'active', categoryId]);
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [categoryId]);
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar categoria.', error: error.message });
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
    res.status(500).json({ message: 'Erro ao remover categoria.', error: error.message });
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
    res.status(500).json({ message: 'Erro ao carregar produtos.', error: error.message });
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
    const {
      name,
      description,
      categoryId,
      price,
      promotionalPrice,
      image,
      stock,
      unit,
      status,
      available,
      featured,
      promotion
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'O nome do produto é obrigatório.' });
    }

    const finalPrice = Number(price || 0);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return res.status(400).json({ message: 'O preço do produto deve ser maior que zero.' });
    }

    const productImage = image || '/assets/images/default-product.jpg';
    const finalStock = Number(stock || 0);

    const result = await dbRun(`
      INSERT INTO products (name, description, category_id, price, promotional_price, image, stock, unit, status, available, featured, promotion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(name).trim(),
      description || '',
      categoryId ? Number(categoryId) : null,
      finalPrice,
      promotionalPrice && Number(promotionalPrice) > 0 ? Number(promotionalPrice) : null,
      productImage,
      finalStock,
      unit || 'unidade',
      status === 'inactive' ? 'inactive' : 'active',
      parseBoolean(available) ? 1 : 0,
      parseBoolean(featured) ? 1 : 0,
      parseBoolean(promotion) ? 1 : 0,
    ]);

    const created = await dbGet('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [result.id]);
    res.status(201).json(formatProduct(created));
  } catch (error) {
    res.status(500).json({ message: 'Erro ao cadastrar produto.', error: error.message });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const {
      name,
      description,
      categoryId,
      price,
      promotionalPrice,
      image,
      stock,
      unit,
      status,
      available,
      featured,
      promotion
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'O nome do produto é obrigatório.' });
    }

    const finalPrice = Number(price || 0);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return res.status(400).json({ message: 'O preço do produto deve ser maior que zero.' });
    }

    await dbRun(`
      UPDATE products SET
        name = ?,
        description = ?,
        category_id = ?,
        price = ?,
        promotional_price = ?,
        image = ?,
        stock = ?,
        unit = ?,
        status = ?,
        available = ?,
        featured = ?,
        promotion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      String(name).trim(),
      description || '',
      categoryId ? Number(categoryId) : null,
      finalPrice,
      promotionalPrice && Number(promotionalPrice) > 0 ? Number(promotionalPrice) : null,
      image || '/assets/images/default-product.jpg',
      Number(stock || 0),
      unit || 'unidade',
      status === 'inactive' ? 'inactive' : 'active',
      parseBoolean(available) ? 1 : 0,
      parseBoolean(featured) ? 1 : 0,
      parseBoolean(promotion) ? 1 : 0,
      productId
    ]);

    const updated = await dbGet('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [productId]);
    res.json(formatProduct(updated));
  } catch (error) {
    res.status(500).json({ message: 'Erro ao editar produto.', error: error.message });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    await dbRun('DELETE FROM products WHERE id = ?', [productId]);
    res.json({ message: 'Produto removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao remover produto.', error: error.message });
  }
});

app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar configurações.', error: error.message });
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
    res.status(500).json({ message: 'Erro ao salvar configurações.', error: error.message });
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
