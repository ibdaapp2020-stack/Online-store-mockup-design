import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(join(dataDir, 'shop.db'))

export function loadEnv() {
  const file = join(root, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].trim()
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 32)
  const current = Buffer.from(hash, 'hex')
  if (current.length !== next.length) return false
  return timingSafeEqual(current, next)
}

export function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    compareAt: row.compare_at == null ? undefined : row.compare_at,
    description: row.description,
    specs: JSON.parse(row.specs),
    stock: row.stock,
    badge: row.badge || undefined,
    rating: row.rating,
    reviews: row.reviews,
    tone: row.tone,
    image: row.image,
    active: row.active === 1,
    sizes: asJsonList(row.sizes),
    colors: asJsonList(row.colors),
    choices: asJsonValue(row.choices, { size: false, color: false, other: false, otherLabel: 'אחר', others: [] }),
    variants: asJsonValue(row.variants, []),
  }
}

function asJsonValue(value, fallback) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return value
  if (value == null || value === '') return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function asJsonList(value) {
  if (Array.isArray(value)) return value.map(String)
  if (value == null || value === '') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function mapOrder(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    customer: JSON.parse(row.customer_json),
    items: JSON.parse(row.items_json),
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    total: row.total,
    coupon: row.coupon || undefined,
  }
}

const DEFAULT_SETTINGS = {
  storeName: 'PRO PHARM',
  tagline: 'ORTHO & MOBILITY',
  banner: '',
  showBanner: false,
  disclaimer: 'האתר אינו בית מרקחת ואינו מחליף ייעוץ רפואי. המוצרים המוצגים הם ללא מרשם.',
  shippingFee: 29,
  freeFrom: 199,
  couponCode: 'DEMO10',
  couponPercent: 10,
  paymentNote: 'ההזמנה נשמרת בחנות. סליקת אשראי עדיין לא מחוברת, ופרטי הכרטיס לא נשמרים.',
  loyaltyMode: 'points',
  pointsPer100: 10,
  clubPercent: 5,
  notifyEmail: 'propharm2026@gmail.com',
  smtpUser: 'propharm2026@gmail.com',
  smtpPass: '',
}

export function getSettings() {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get()
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.data) }
}

export function quoteOrder(subtotal, couponOn, settings) {
  const discount = couponOn ? Math.round(subtotal * (settings.couponPercent / 100)) : 0
  const shipping = subtotal === 0 || subtotal >= settings.freeFrom ? 0 : settings.shippingFee
  return { subtotal, discount, shipping, total: subtotal - discount + shipping }
}

async function loadSeed() {
  const outfile = join(dataDir, 'seed.mjs')
  await esbuild.build({
    entryPoints: [join(root, 'src/data.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    logLevel: 'silent',
  })
  return import(pathToFileURL(outfile).href)
}

export async function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      blurb TEXT NOT NULL,
      sort INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      compare_at INTEGER,
      description TEXT NOT NULL,
      specs TEXT NOT NULL,
      stock INTEGER NOT NULL,
      badge TEXT,
      rating REAL NOT NULL,
      reviews INTEGER NOT NULL,
      tone TEXT NOT NULL,
      image TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      customer_json TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL,
      coupon TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `)

  const settings = db.prepare('SELECT id FROM settings WHERE id = 1').get()
  if (!settings) {
    db.prepare('INSERT INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(DEFAULT_SETTINGS))
  }

  const password = process.env.ADMIN_PASSWORD || 'SyncShop2026'
  const adminUser = String(process.env.ADMIN_USERNAME || 'propharm').toLowerCase()
  const admin = db.prepare('SELECT id FROM admin WHERE id = 1').get()
  if (!admin) {
    db.prepare('INSERT INTO admin (id, password_hash) VALUES (1, ?)').run(hashPassword(password))
  } else {
    db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(hashPassword(password))
  }
  try {
    db.prepare('UPDATE admin SET username = ? WHERE id = 1').run(adminUser)
  } catch {
    /* username column is added later */
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM products').get().count > 0) return

  const seed = await loadSeed()
  const insertCategory = db.prepare('INSERT INTO categories (id, name, blurb, sort) VALUES (?, ?, ?, ?)')
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, category, price, compare_at, description, specs, stock, badge, rating, reviews, tone, image, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `)
  const addProduct = (product) => {
    insertProduct.run(
      product.id,
      product.name,
      product.category,
      product.price,
      product.compareAt ?? null,
      product.description,
      JSON.stringify(product.specs ?? []),
      product.stock,
      product.badge ?? null,
      product.rating,
      product.reviews,
      product.tone,
      product.image || `/products/${product.id}.png`,
    )
  }
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, created_at, status, customer_json, items_json, subtotal, discount, shipping, total, coupon
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    seed.CATEGORIES.forEach((category, index) => {
      insertCategory.run(category.id, category.name, category.blurb, index)
    })
    for (const product of seed.PRODUCTS) addProduct(product)
    for (const order of seed.SEED_ORDERS) {
      insertOrder.run(
        order.id,
        order.createdAt,
        order.status,
        JSON.stringify(order.customer),
        JSON.stringify(order.items),
        order.subtotal,
        order.discount,
        order.shipping,
        order.total,
        order.coupon ?? null,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function nextOrderId() {
  const rows = db.prepare('SELECT id FROM orders').all()
  const nums = rows.map((row) => Number(String(row.id).replace('MED-', ''))).filter((value) => Number.isFinite(value))
  const next = Math.max(10040, ...nums, 10040) + 1
  return `MED-${next}`
}
