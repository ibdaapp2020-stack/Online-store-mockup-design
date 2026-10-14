/**
 * מיגרציה ל-Firebase.
 * ברירת מחדל: dry-run.
 * בדיקה: FIREBASE_MIGRATE_CONFIRM=YES node scripts/migrate-to-firebase.mjs --apply-test
 * פרודקשן: נעצר בלי FIREBASE_LIVE=YES
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../server/db.mjs'

loadEnv()

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const applyTest = process.argv.includes('--apply-test')
const applyLive = process.argv.includes('--apply')
const confirm = process.env.FIREBASE_MIGRATE_CONFIRM === 'YES'
const backupDir = process.env.BACKUP_DIR || join(root, 'backups', 'pro-pharm-2026-10-14T06-10-44-686Z')
const dbPath = existsSync(join(backupDir, 'data', 'shop.db')) ? join(backupDir, 'data', 'shop.db') : join(root, 'data', 'shop.db')
const imagesDir = existsSync(join(backupDir, 'public', 'products')) ? join(backupDir, 'public', 'products') : join(root, 'public', 'products')

function json(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapProduct(row) {
  const images = json(row.images, [])
  return {
    id: row.id,
    name: row.name,
    sku: row.sku || row.id,
    barcode: row.barcode || '',
    brand: row.brand || '',
    category: row.category,
    subcategory: row.subcategory || '',
    price: row.price,
    compareAt: row.compare_at ?? null,
    costPrice: row.cost_price ?? null,
    salePrice: row.sale_price ?? null,
    saleStart: row.sale_start || null,
    saleEnd: row.sale_end || null,
    description: row.description,
    shortDescription: row.short_description || '',
    specs: json(row.specs, []),
    stock: row.stock,
    lowStockThreshold: row.low_stock_threshold ?? null,
    trackInventory: row.track_inventory == null ? true : Number(row.track_inventory) === 1,
    allowBackorder: Number(row.allow_backorder) === 1,
    unit: row.unit || 'יח׳',
    badge: row.badge || null,
    rating: row.rating,
    reviews: row.reviews,
    tone: row.tone,
    image: row.image,
    images: images.length ? images : row.image ? [row.image] : [],
    active: Number(row.active) === 1,
    status: row.status || (Number(row.active) === 1 ? 'active' : 'inactive'),
    seoTitle: row.seo_title || '',
    seoDescription: row.seo_description || '',
    slug: row.slug || row.id,
    sizes: json(row.sizes, []),
    colors: json(row.colors, []),
    choices: json(row.choices, { size: false, color: false, other: false, otherLabel: 'אחר', others: [] }),
    variants: json(row.variants, []),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

const db = new DatabaseSync(dbPath)
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((row) => row.name)
function rows(name) {
  try {
    return db.prepare(`SELECT * FROM ${name}`).all()
  } catch {
    return []
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: dbPath,
  tables,
  categories: rows('categories'),
  products: rows('products').map(mapProduct),
  orders: rows('orders').map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    customer: json(row.customer_json, {}),
    items: json(row.items_json, []),
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    total: row.total,
    coupon: row.coupon || null,
  })),
  customers: rows('customers').map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    points: row.points,
    nextPercent: row.next_percent,
    birthday: row.birthday || '',
    city: row.city || '',
    address: row.address || '',
    couponCode: row.coupon_code || '',
    couponPercent: row.coupon_percent || 0,
    createdAt: row.created_at,
  })),
  employees: rows('employees').map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    active: Number(row.active) === 1,
    payMode: row.pay_mode,
    hourlyRate: row.hourly_rate,
    globalPay: row.global_pay,
  })),
  services: rows('services').map((row) => ({
    id: row.id,
    name: row.name,
    days: json(row.days, []),
    openTime: row.open_time,
    closeTime: row.close_time,
    slotMinutes: row.slot_minutes,
    therapist: row.therapist || '',
    active: Number(row.active) === 1,
  })),
  appointments: rows('appointments'),
  attendance: rows('attendance'),
  corrections: rows('corrections'),
  mailLog: rows('mail_log'),
  productEvents: rows('product_events'),
  settings: json(db.prepare('SELECT data FROM settings WHERE id = 1').get()?.data, {}),
}

const issues = []
const skuCount = {}
for (const product of payload.products) {
  skuCount[product.sku] = (skuCount[product.sku] || 0) + 1
  if (!payload.categories.some((category) => category.id === product.category)) issues.push({ type: 'missing-category', id: product.id })
}
for (const [sku, n] of Object.entries(skuCount)) if (n > 1) issues.push({ type: 'duplicate-sku', sku, n })

const outDir = join(root, 'backups', 'firebase-dry-run')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'export.json'), JSON.stringify({ ...payload, issueCount: issues.length, issues }, null, 2))

const summary = {
  ok: issues.length === 0,
  mode: applyLive ? 'apply-live-requested' : applyTest ? 'apply-test-requested' : 'dry-run',
  source: dbPath,
  counts: {
    products: payload.products.length,
    categories: payload.categories.length,
    orders: payload.orders.length,
    customers: payload.customers.length,
    employees: payload.employees.length,
    services: payload.services.length,
    appointments: payload.appointments.length,
    attendance: payload.attendance.length,
    corrections: payload.corrections.length,
    mailLog: payload.mailLog.length,
    productEvents: payload.productEvents.length,
  },
  tables,
  matchExpected: payload.products.length === 85 && payload.categories.length === 6,
  issueCount: issues.length,
}

console.log(JSON.stringify(summary, null, 2))

if (!applyTest && !applyLive) {
  db.close()
  process.exit(issues.length ? 1 : 0)
}

if (!confirm) {
  console.error('נעצר: חסר FIREBASE_MIGRATE_CONFIRM=YES. SQLite לא נמחק.')
  process.exit(2)
}

if (applyLive && process.env.FIREBASE_LIVE !== 'YES') {
  console.error('נעצר: מיגרציית פרודקשן דורשת FIREBASE_LIVE=YES ואישור נוסף. SQLite לא נמחק.')
  process.exit(3)
}

if (applyTest) {
  process.env.DATA_SOURCE = 'firebase-test'
  process.env.FIREBASE_COLLECTION_PREFIX = process.env.FIREBASE_COLLECTION_PREFIX || 'staging_'
}

const { repo } = await import('../server/firebase-repo.mjs')
const store = repo()
const written = {}

async function writeAll(name, items) {
  let count = 0
  for (const item of items) {
    const id = String(item.id || item.name || `${name}-${count}`)
    await store.set(name, id, { ...item, id, migratedAt: new Date().toISOString() })
    count += 1
  }
  written[name] = count
}

await writeAll('categories', payload.categories)
await writeAll('products', payload.products)
await writeAll('orders', payload.orders)
await writeAll('customers', payload.customers)
await writeAll('employees', payload.employees)
await writeAll('services', payload.services)
await writeAll('appointments', payload.appointments)
await writeAll('attendance', payload.attendance)
await writeAll('corrections', payload.corrections)
await writeAll('mailLog', payload.mailLog)
await writeAll('productEvents', payload.productEvents)
await store.set('settings', 'shop', payload.settings)

let uploaded = 0
let skipped = 0
for (const product of payload.products) {
  for (const image of product.images.length ? product.images : [product.image]) {
    const file = String(image || '').split('/').pop()
    const local = join(imagesDir, file || '')
    if (!file || !existsSync(local)) {
      skipped += 1
      continue
    }
    const url = await store.uploadBuffer(`products/${product.id}/${file}`, readFileSync(local), file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.svg') ? 'image/svg+xml' : 'image/png')
    const images = (product.images || []).map((item) => (String(item).endsWith(file) ? url : item))
    await store.set('products', product.id, {
      ...product,
      image: product.image && String(product.image).endsWith(file) ? url : product.image === image ? url : product.image,
      images: images.length ? images : [url],
    })
    uploaded += 1
  }
}

const verified = {
  products: (await store.all('products')).length,
  categories: (await store.all('categories')).length,
  orders: (await store.all('orders')).length,
  customers: (await store.all('customers')).length,
  employees: (await store.all('employees')).length,
  services: (await store.all('services')).length,
}

writeFileSync(join(outDir, 'apply-result.json'), JSON.stringify({ written, uploaded, skipped, verified, prefix: store.prefix }, null, 2))
console.log(JSON.stringify({ written, uploaded, skipped, verified, prefix: store.prefix, sqliteUntouched: true }, null, 2))
db.close()
