import { DatabaseSync } from 'node:sqlite'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = join(root, 'data', 'shop.db')
const productsDir = join(root, 'public', 'products')
const uploadsDir = join(root, 'public', 'uploads')

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA wal_checkpoint(PASSIVE)')

function count(sql) {
  return db.prepare(sql).get().count
}

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => !name.startsWith('.') && !statSync(join(dir, name)).isDirectory())
}

const products = db.prepare('SELECT id, sku, name, category, image, images, status, active, stock FROM products').all()
const categories = db.prepare('SELECT id, name FROM categories ORDER BY sort').all()
const imageFiles = new Set([...files(productsDir), ...files(uploadsDir)])
const missingImages = []
const extraCategory = []
const duplicateSku = {}
for (const product of products) {
  const sku = product.sku || product.id
  duplicateSku[sku] = (duplicateSku[sku] || 0) + 1
  if (!categories.some((category) => category.id === product.category)) extraCategory.push(product.id)
  let images = []
  try {
    images = JSON.parse(product.images || '[]')
  } catch {
    images = []
  }
  const refs = [product.image, ...images].filter(Boolean)
  for (const ref of refs) {
    if (String(ref).startsWith('data:')) continue
    const name = String(ref).split('/').pop()
    if (name && !imageFiles.has(name) && !String(ref).startsWith('http')) missingImages.push({ id: product.id, ref })
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  database: dbPath,
  counts: {
    products: count('SELECT COUNT(*) AS count FROM products'),
    activeProducts: count("SELECT COUNT(*) AS count FROM products WHERE COALESCE(status, CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END) = 'active'"),
    categories: count('SELECT COUNT(*) AS count FROM categories'),
    orders: count('SELECT COUNT(*) AS count FROM orders'),
    customers: count('SELECT COUNT(*) AS count FROM customers'),
    appointments: count('SELECT COUNT(*) AS count FROM appointments'),
    employees: count('SELECT COUNT(*) AS count FROM employees'),
    services: count('SELECT COUNT(*) AS count FROM services'),
    productEvents: count('SELECT COUNT(*) AS count FROM product_events'),
    sessions: count('SELECT COUNT(*) AS count FROM sessions'),
  },
  categories: categories.map((row) => ({
    ...row,
    products: products.filter((product) => product.category === row.id).length,
  })),
  integrity: {
    duplicateSkus: Object.entries(duplicateSku).filter(([, n]) => n > 1).map(([sku, n]) => ({ sku, n })),
    productsWithoutCategory: extraCategory,
    missingImages: missingImages.slice(0, 30),
    missingImageCount: missingImages.length,
    productImageFiles: files(productsDir).length,
    uploadedFiles: files(uploadsDir).length,
  },
}

console.log(JSON.stringify(report, null, 2))
db.close()
