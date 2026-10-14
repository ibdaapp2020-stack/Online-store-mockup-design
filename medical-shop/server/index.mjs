import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import express from 'express'
import multer from 'multer'
import { applyClubDiscount, adminSettings, lineOptions, nextSettings, personalCoupon, publicSettings, readSession, registerClub, settleClub, signSession, takeVariantStock, writeSessionCookie } from './club.mjs'
import { db, getSettings, hashPassword, initDb, loadEnv, mapOrder, mapProduct, migrateProductSchema, nextOrderId, quoteOrder, verifyPassword } from './db.mjs'
import { persistLive, restoreLive } from './live-store.mjs'
import { publicCatalogProducts, registerProducts } from './products.mjs'
import { firebaseStatus, isFirebaseData } from './firebase.mjs'
import { registerFirebaseApi, verifyFirebaseAdmin } from './firebase-api.mjs'

loadEnv()
await initDb()

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const uploads = join(root, 'public', 'uploads')
mkdirSync(uploads, { recursive: true })

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif', '.avif', '.ico', '.tif', '.tiff', '.jfif', '.pjp', '.pjpeg'])

function isImageUpload(file) {
  const mime = String(file.mimetype || '').toLowerCase()
  const ext = extname(file.originalname || '').toLowerCase()
  return mime.startsWith('image/') || IMAGE_EXT.has(ext)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (isImageUpload(file)) callback(null, true)
    else callback(new Error('אפשר להעלות כל סוג תמונה: PNG, JPG, JPEG, GIF, WEBP ועוד'))
  },
})

function storedImage(file) {
  const ext = extname(file.originalname || '').toLowerCase() || '.png'
  const mime = String(file.mimetype || '').startsWith('image/') ? file.mimetype : `image/${ext.slice(1) || 'png'}`
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
  try {
    writeFileSync(join(uploads, name), file.buffer)
    return `/uploads/${name}`
  } catch {
    // On serverless hosts the disk may be read-only; the data URL still works.
    return `data:${mime};base64,${file.buffer.toString('base64')}`
  }
}

function materializeImages() {
  const rows = db.prepare("SELECT id, image FROM products WHERE image LIKE 'data:%'").all()
  const update = db.prepare('UPDATE products SET image = ? WHERE id = ?')
  for (const row of rows) {
    const match = /^data:([^;,]+)(?:;[^,]*)?;base64,([\s\S]+)$/.exec(String(row.image || ''))
    if (!match) continue
    const mime = match[1].toLowerCase()
    const ext = mime.includes('png')
      ? '.png'
      : mime.includes('jpeg') || mime.includes('jpg')
        ? '.jpg'
        : mime.includes('webp')
          ? '.webp'
          : mime.includes('gif')
            ? '.gif'
            : mime.includes('svg')
              ? '.svg'
              : mime.includes('bmp')
                ? '.bmp'
                : mime.includes('avif')
                  ? '.avif'
                  : '.img'
    const safeId = String(row.id).replace(/[^a-z0-9-]+/gi, '').slice(0, 40) || 'item'
    const name = `${safeId}-${randomBytes(3).toString('hex')}${ext}`
    try {
      writeFileSync(join(uploads, name), Buffer.from(match[2], 'base64'))
      update.run(`/uploads/${name}`, row.id)
    } catch {
      // Keep the data URL when the disk cannot store the file.
    }
  }
}

const app = express()
app.use(express.json({ limit: '16mb' }))
app.use(cookieParser())
app.use(express.static(join(root, 'public')))

function requireAdmin(req, res, next) {
  const token = req.cookies.medica_admin
  if (token && readSession(db, token, 'admin')) return next()
  verifyFirebaseAdmin(req)
    .then((admin) => {
      if (admin) return next()
      res.status(401).json({ error: 'נדרשת כניסת ניהול' })
    })
    .catch(() => res.status(401).json({ error: 'נדרשת כניסת ניהול' }))
}

app.get('/api/admin/firebase/status', (_req, res) => {
  res.json(firebaseStatus())
})

app.post('/api/admin/login-firebase', async (req, res) => {
  try {
    const admin = await verifyFirebaseAdmin({ headers: { authorization: `Bearer ${req.body?.idToken || ''}` } })
    if (!admin) return res.status(401).json({ error: 'אין הרשאת ניהול ב-Firebase' })
    const token = signSession(db, 'admin', { uid: admin.uid })
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, new Date().toISOString())
    writeSessionCookie(res, 'medica_admin', token)
    res.json({ ok: true, uid: admin.uid })
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'כניסת Firebase נכשלה' })
  }
})

if (isFirebaseData()) {
  registerFirebaseApi(app, { requireAdmin, upload })
}

if (!isFirebaseData()) app.get('/api/catalog', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const categories = db.prepare('SELECT id, name, blurb, image FROM categories ORDER BY sort').all()
  const products = publicCatalogProducts(db)
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
      const product = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(status, CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END) = 'active'").get(line.productId)
      const qty = Number(line.qty)
      if (!product || !Number.isInteger(qty) || qty < 1) throw new Error('מוצר לא זמין')
      const allowEmpty = Number(product.allow_backorder) === 1 || settings.allowSellWithoutStock || Number(product.track_inventory) === 0
      const options = lineOptions(product, { ...line, qty }, allowEmpty)
      if (options.tracked) takeVariantStock(db, product, options, qty)
      else {
        if (product.stock < qty && !allowEmpty) throw new Error(`אין מספיק מלאי עבור ${product.name}`)
        if (Number(product.track_inventory) !== 0) db.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?').run(qty, product.id)
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
  try {
    const admin = db.prepare('SELECT username, password_hash FROM admin WHERE id = 1').get()
    const username = String(admin?.username || process.env.ADMIN_USERNAME || 'propharm').toLowerCase()
    const given = String(req.body?.username ?? req.body?.login ?? '').trim().toLowerCase() || username
    if (!admin || given !== username || !verifyPassword(String(req.body?.password ?? ''), admin.password_hash)) {
      return res.status(401).json({ error: 'שם המשתמש או הסיסמה שגויים' })
    }
    const token = signSession(db, 'admin')
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, new Date().toISOString())
    writeSessionCookie(res, 'medica_admin', token)
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'כניסת ניהול נכשלה' })
  }
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
  const threshold = Number(getSettings().lowStockThreshold ?? 5)
  const lowStock = db
    .prepare('SELECT * FROM products WHERE COALESCE(status, CASE WHEN active = 1 THEN \'active\' ELSE \'inactive\' END) = \'active\' AND stock > 0 AND stock <= ? ORDER BY stock')
    .all(threshold)
    .map(mapProduct)
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

if (!isFirebaseData()) registerProducts(app, { db, requireAdmin, upload, storedImage, uploadsDir: uploads })

if (!isFirebaseData()) app.get('/api/admin/orders', requireAdmin, (_req, res) => {
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
  persistLive(db)
  res.json(adminSettings(next))
})

registerClub(app, { db, requireAdmin })
try {
  db.prepare('UPDATE admin SET username = ? WHERE id = 1').run(String(process.env.ADMIN_USERNAME || 'propharm').toLowerCase())
} catch {
  /* username column missing */
}
db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(hashPassword(process.env.ADMIN_PASSWORD || 'SyncShop2026'))
restoreLive(db)
migrateProductSchema(db)
materializeImages()
persistLive(db)

app.use((error, _req, res, next) => {
  if (!error) return next()
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'התמונה גדולה מדי. אפשר עד 12MB.' })
  }
  return res.status(400).json({ error: error.message || 'העלאה נכשלה' })
})

const port = Number(process.env.API_PORT || 5180)
app.listen(port, '127.0.0.1', () => {
  console.log(`API http://127.0.0.1:${port} source=${process.env.DATA_SOURCE || 'sqlite'}`)
})

export default app
