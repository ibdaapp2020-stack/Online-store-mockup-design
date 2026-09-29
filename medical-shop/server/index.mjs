import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import express from 'express'
import multer from 'multer'
import { applyClubDiscount, adminSettings, lineOptions, nextSettings, personalCoupon, publicSettings, readSession, registerClub, saveProductOptions, settleClub, signSession, takeVariantStock, writeSessionCookie } from './club.mjs'
import { bootError as seedError, db, getSettings, initDb, loadEnv, mapOrder, mapProduct, nextOrderId, quoteOrder, verifyPassword } from './db.mjs'

loadEnv()
let bootError = seedError
try {
  if (!bootError) await initDb()
} catch (error) {
  bootError = error
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const uploads = process.env.VERCEL ? join('/tmp', 'uploads') : join(root, 'public', 'uploads')
mkdirSync(uploads, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: uploads,
    filename: (_req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase()
      callback(null, `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype))
  },
})

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

function requireAdmin(req, res, next) {
  const token = req.cookies.medica_admin
  if (token && readSession(db, token, 'admin')) return next()
  const session = token && db.prepare('SELECT token FROM sessions WHERE token = ?').get(token)
  if (!session) return res.status(401).json({ error: 'נדרשת כניסת ניהול' })
  next()
}

app.use('/api', (req, res, next) => {
  if (!bootError) return next()
  res.status(500).json({ error: bootError.message })
})

app.get('/api/catalog', (_req, res) => {
  const categories = db.prepare('SELECT id, name, blurb FROM categories ORDER BY sort').all()
  const products = db
    .prepare('SELECT * FROM products WHERE active = 1 ORDER BY rowid')
    .all()
    .map(mapProduct)
  res.json({ categories, products, settings: publicSettings(getSettings()) })
})

app.get('/api/orders/track/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? COLLATE NOCASE').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'ההזמנה לא נמצאה' })
  res.json(mapOrder(row))
})

app.post('/api/orders', (req, res) => {
  const customer = req.body?.customer ?? {}
  const lines = Array.isArray(req.body?.items) ? req.body.items : []
  const name = String(customer.name ?? '').trim()
  const phone = String(customer.phone ?? '').trim()
  const city = String(customer.city ?? '').trim()
  const address = String(customer.address ?? '').trim()
  if (!name || !phone || !city || !address || lines.length === 0) {
    return res.status(400).json({ error: 'חסרים פרטי הזמנה' })
  }

  const settings = getSettings()
  const personal = personalCoupon(db, req, req.body?.coupon)
  const couponOn = !personal && String(req.body?.coupon ?? '').trim().toUpperCase() === settings.couponCode.toUpperCase()
  const items = []

  db.exec('BEGIN')
  try {
    for (const line of lines) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(line.productId)
      const qty = Number(line.qty)
      if (!product || !Number.isInteger(qty) || qty < 1) throw new Error('מוצר לא זמין')
      const options = lineOptions(product, { ...line, qty })
      if (options.tracked) takeVariantStock(db, product, options, qty)
      else {
        if (product.stock < qty) throw new Error(`אין מספיק מלאי עבור ${product.name}`)
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, product.id)
      }
      items.push({ productId: product.id, name: product.name, price: product.price, qty, size: options.size, color: options.color, other: options.other })
    }
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    const quoted = quoteOrder(subtotal, couponOn, settings)
    if (personal) {
      quoted.discount = Math.round(subtotal * (personal.percent / 100))
      quoted.total = subtotal - quoted.discount + quoted.shipping
    }
    const club = applyClubDiscount(db, req, quoted, settings)
    const priced = club.priced
    const order = {
      id: nextOrderId(),
      createdAt: new Date().toISOString(),
      status: 'received',
      customer: { name, phone, city, address, customerId: club.customerId },
      items,
      ...priced,
      coupon: personal ? personal.code : couponOn ? settings.couponCode : undefined,
    }
    db.prepare(
      `INSERT INTO orders (id, created_at, status, customer_json, items_json, subtotal, discount, shipping, total, coupon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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
    db.exec('COMMIT')
    settleClub(db, req, order, settings).catch(() => {})
    res.status(201).json(order)
  } catch (error) {
    db.exec('ROLLBACK')
    res.status(400).json({ error: error instanceof Error ? error.message : 'לא ניתן לקלוט את ההזמנה' })
  }
})

app.post('/api/admin/login', (req, res) => {
  const admin = db.prepare('SELECT username, password_hash FROM admin WHERE id = 1').get()
  const username = String(admin?.username || 'admin').toLowerCase()
  const given = String(req.body?.username ?? req.body?.login ?? '').trim().toLowerCase()
  if (!admin || given !== username || !verifyPassword(String(req.body?.password ?? ''), admin.password_hash)) {
    return res.status(401).json({ error: 'שם המשתמש או הסיסמה שגויים' })
  }
  const token = signSession(db, 'admin')
  db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, new Date().toISOString())
  writeSessionCookie(res, 'medica_admin', token)
  res.json({ ok: true })
})

app.post('/api/admin/logout', (req, res) => {
  if (req.cookies.medica_admin) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.cookies.medica_admin)
  res.clearCookie('medica_admin', { path: '/' })
  res.json({ ok: true })
})

app.get('/api/admin/me', requireAdmin, (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const orders = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM orders').get()
  const open = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status != 'delivered'").get()
  const products = db.prepare('SELECT COUNT(*) AS count FROM products').get()
  const lowStock = db.prepare('SELECT * FROM products WHERE active = 1 AND stock <= 5 ORDER BY stock').all().map(mapProduct)
  const recent = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 6').all().map(mapOrder)
  const customers = db.prepare('SELECT * FROM customers').all().length
  const appointments = db.prepare('SELECT * FROM appointments').all().filter((item) => item.status === 'booked').length
  const employees = db.prepare('SELECT * FROM employees').all().length
  const allOrders = db.prepare('SELECT * FROM orders').all()
  const daily = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)
    const rows = allOrders.filter((order) => String(order.created_at).slice(0, 10) === date)
    daily.push({
      date: date.slice(5),
      total: rows.reduce((sum, order) => sum + Number(order.total || 0), 0),
      count: rows.length,
    })
  }
  const pipeline = { received: 0, packing: 0, shipped: 0, delivered: 0 }
  for (const order of allOrders) {
    if (pipeline[order.status] != null) pipeline[order.status] += 1
  }
  res.json({
    orders: orders.count,
    revenue: orders.revenue,
    open: open.count,
    products: products.count,
    customers,
    appointments,
    employees,
    lowStock,
    recent,
    daily,
    pipeline,
  })
})

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY rowid').all().map(mapProduct))
})

function readProduct(body, image) {
  const specs = String(body.specs ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    name: String(body.name ?? '').trim(),
    category: String(body.category ?? '').trim(),
    price: Number(body.price),
    compareAt: body.compareAt === '' || body.compareAt == null ? null : Number(body.compareAt),
    description: String(body.description ?? '').trim(),
    specs,
    stock: Number(body.stock),
    badge: body.badge ? String(body.badge) : null,
    rating: Number(body.rating),
    reviews: Number(body.reviews),
    tone: String(body.tone || '#0f766e'),
    image,
    active: body.active === 'false' || body.active === false ? 0 : 1,
  }
}

function validProduct(product) {
  return product.name && product.category && Number.isFinite(product.price) && product.price >= 0 && Number.isInteger(product.stock) && product.stock >= 0 && product.specs.length > 0
}

app.post('/api/admin/products', requireAdmin, upload.single('imageFile'), (req, res) => {
  const image = req.file ? `/uploads/${req.file.filename}` : String(req.body.image || '').trim()
  const product = readProduct(req.body, image || '/products/kit.png')
  if (!validProduct(product)) return res.status(400).json({ error: 'חסרים שדות מוצר' })
  let id = String(req.body.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!id) id = `item-${Date.now().toString(36)}`
  if (db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return res.status(400).json({ error: 'המזהה כבר קיים' })
  db.prepare(
    `INSERT INTO products (id, name, category, price, compare_at, description, specs, stock, badge, rating, reviews, tone, image, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    product.name,
    product.category,
    product.price,
    product.compareAt,
    product.description,
    JSON.stringify(product.specs),
    product.stock,
    product.badge,
    Number.isFinite(product.rating) ? product.rating : 4.5,
    Number.isFinite(product.reviews) ? product.reviews : 0,
    product.tone,
    product.image,
    product.active,
  )
  saveProductOptions(db, id, req.body)
  res.status(201).json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)))
})

app.patch('/api/admin/products/:id', requireAdmin, upload.single('imageFile'), (req, res) => {
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
  const image = req.file ? `/uploads/${req.file.filename}` : String(req.body.image || current.image)
  const product = readProduct(req.body, image)
  if (!validProduct(product)) return res.status(400).json({ error: 'חסרים שדות מוצר' })
  db.prepare(
    `UPDATE products SET name=?, category=?, price=?, compare_at=?, description=?, specs=?, stock=?, badge=?, rating=?, reviews=?, tone=?, image=?, active=? WHERE id=?`,
  ).run(
    product.name,
    product.category,
    product.price,
    product.compareAt,
    product.description,
    JSON.stringify(product.specs),
    product.stock,
    product.badge,
    Number.isFinite(product.rating) ? product.rating : current.rating,
    Number.isFinite(product.reviews) ? product.reviews : current.reviews,
    product.tone,
    product.image,
    product.active,
    req.params.id,
  )
  saveProductOptions(db, req.params.id, req.body)
  res.json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)))
})

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(mapOrder))
})

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const statuses = ['received', 'packing', 'shipped', 'delivered']
  if (!statuses.includes(req.body?.status)) return res.status(400).json({ error: 'סטטוס לא תקין' })
  const current = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'ההזמנה לא נמצאה' })
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id)
  res.json(mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)))
})

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json(adminSettings(getSettings()))
})

app.patch('/api/admin/settings', requireAdmin, (req, res) => {
  const current = getSettings()
  const next = nextSettings(current, req.body)
  if (!next.storeName || !Number.isFinite(next.shippingFee) || !Number.isFinite(next.freeFrom) || !Number.isFinite(next.couponPercent)) {
    return res.status(400).json({ error: 'הגדרות לא תקינות' })
  }
  db.prepare('UPDATE settings SET data = ? WHERE id = 1').run(JSON.stringify(next))
  res.json(adminSettings(next))
})

registerClub(app, { db, requireAdmin })

const port = Number(process.env.PORT) || 5180
if (process.env.VERCEL) app.listen(port)
else app.listen(port, '127.0.0.1', () => console.log(`API http://127.0.0.1:${port}`))
