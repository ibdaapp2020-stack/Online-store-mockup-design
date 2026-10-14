import { randomBytes } from 'node:crypto'
import { existsSync, unlinkSync as removeFile } from 'node:fs'
import { basename, join } from 'node:path'
import { getSettings, mapProduct, mapPublicProduct, migrateProductSchema } from './db.mjs'
import { persistLive } from './live-store.mjs'
import { saveProductOptions } from './club.mjs'

function nowIso() {
  return new Date().toISOString()
}

function eventId() {
  return `evt-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
}

function slugify(value, fallback) {
  const hebrewSafe = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
  return hebrewSafe || fallback
}

function numberOrNull(value) {
  if (value === '' || value == null) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function intOrZero(value) {
  const next = Number(value)
  return Number.isInteger(next) && next >= 0 ? next : 0
}

function asList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (value == null || value === '') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return String(value)
      .split(/[,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

function productUsed(db, id) {
  const orders = db.prepare('SELECT items_json FROM orders').all()
  return orders.some((order) => {
    try {
      return JSON.parse(order.items_json).some((item) => item.productId === id)
    } catch {
      return false
    }
  })
}

function logEvent(db, productId, kind, detail, actor = 'admin') {
  db.prepare('INSERT INTO product_events (id, product_id, kind, actor, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    eventId(),
    productId,
    kind,
    actor,
    detail,
    nowIso(),
  )
}

function history(db, productId) {
  return db
    .prepare('SELECT * FROM product_events WHERE product_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(productId)
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      kind: row.kind,
      actor: row.actor,
      detail: row.detail,
      createdAt: row.created_at,
    }))
}

function thresholdOf(settings, product) {
  if (product?.low_stock_threshold != null && product.low_stock_threshold !== '') return Number(product.low_stock_threshold)
  return Number(settings.lowStockThreshold ?? 5)
}

function readProduct(body, images) {
  const status = ['active', 'inactive', 'draft', 'archived'].includes(body.status) ? body.status : body.active === 'false' || body.active === false ? 'inactive' : 'active'
  return {
    name: String(body.name ?? '').trim(),
    sku: String(body.sku ?? '').trim(),
    barcode: String(body.barcode ?? '').trim(),
    brand: String(body.brand ?? '').trim(),
    category: String(body.category ?? '').trim(),
    subcategory: String(body.subcategory ?? '').trim(),
    price: Number(body.price),
    compareAt: numberOrNull(body.compareAt),
    costPrice: numberOrNull(body.costPrice),
    salePrice: numberOrNull(body.salePrice),
    saleStart: String(body.saleStart ?? '').trim() || null,
    saleEnd: String(body.saleEnd ?? '').trim() || null,
    description: String(body.description ?? '').trim(),
    shortDescription: String(body.shortDescription ?? '').trim(),
    specs: String(body.specs ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    stock: intOrZero(body.stock),
    lowStockThreshold: numberOrNull(body.lowStockThreshold),
    trackInventory: body.trackInventory === 'false' || body.trackInventory === false ? 0 : 1,
    allowBackorder: body.allowBackorder === 'true' || body.allowBackorder === true ? 1 : 0,
    unit: String(body.unit ?? 'יח׳').trim() || 'יח׳',
    badge: body.badge ? String(body.badge) : null,
    rating: Number(body.rating),
    reviews: Number(body.reviews),
    tone: String(body.tone || '#0f766e'),
    images,
    image: images[0] || '/products/placeholder.svg',
    status,
    active: status === 'active' ? 1 : 0,
    seoTitle: String(body.seoTitle ?? '').trim(),
    seoDescription: String(body.seoDescription ?? '').trim(),
    slug: String(body.slug ?? '').trim(),
  }
}

function validProduct(body, product) {
  const priceText = String(body.price ?? '').trim()
  const stockText = String(body.stock ?? '').trim()
  return Boolean(
    product.name &&
      product.category &&
      priceText !== '' &&
      stockText !== '' &&
      Number.isFinite(product.price) &&
      product.price >= 0 &&
      Number.isInteger(product.stock) &&
      product.stock >= 0,
  )
}

function uniqueOrError(db, column, value, exceptId) {
  if (!value) return
  const row = exceptId
    ? db.prepare(`SELECT id FROM products WHERE ${column} = ? AND id != ?`).get(value, exceptId)
    : db.prepare(`SELECT id FROM products WHERE ${column} = ?`).get(value)
  if (row) {
    const label = column === 'sku' ? 'מק״ט' : column === 'barcode' ? 'ברקוד' : 'כתובת slug'
    throw new Error(`${label} כבר בשימוש אצל מוצר אחר`)
  }
}

function collectImages(req, current = []) {
  const kept = asList(req.body?.images ?? req.body?.imageList)
  const uploaded = []
  const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()
  for (const file of files) uploaded.push(req.storedImage(file))
  const fromUrl = String(req.body?.image || '').trim()
  const next = [...kept, ...uploaded]
  if (fromUrl && !next.includes(fromUrl)) next.unshift(fromUrl)
  const unique = [...new Set(next.filter(Boolean))]
  const provided = req.body?.images != null || req.body?.imageList != null
  if (unique.length) return unique
  return provided ? [] : current
}

function saveRow(db, id, product, createdAt) {
  const updated = nowIso()
  db.prepare(
    `INSERT INTO products (
      id, name, sku, barcode, brand, category, subcategory, price, compare_at, cost_price, sale_price, sale_start, sale_end,
      description, short_description, specs, stock, low_stock_threshold, track_inventory, allow_backorder, unit, badge,
      rating, reviews, tone, image, images, active, status, seo_title, seo_description, slug, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, sku=excluded.sku, barcode=excluded.barcode, brand=excluded.brand, category=excluded.category,
      subcategory=excluded.subcategory, price=excluded.price, compare_at=excluded.compare_at, cost_price=excluded.cost_price,
      sale_price=excluded.sale_price, sale_start=excluded.sale_start, sale_end=excluded.sale_end, description=excluded.description,
      short_description=excluded.short_description, specs=excluded.specs, stock=excluded.stock, low_stock_threshold=excluded.low_stock_threshold,
      track_inventory=excluded.track_inventory, allow_backorder=excluded.allow_backorder, unit=excluded.unit, badge=excluded.badge,
      rating=excluded.rating, reviews=excluded.reviews, tone=excluded.tone, image=excluded.image, images=excluded.images,
      active=excluded.active, status=excluded.status, seo_title=excluded.seo_title, seo_description=excluded.seo_description,
      slug=excluded.slug, updated_at=excluded.updated_at`,
  ).run(
    id,
    product.name,
    product.sku,
    product.barcode,
    product.brand,
    product.category,
    product.subcategory,
    product.price,
    product.compareAt,
    product.costPrice,
    product.salePrice,
    product.saleStart,
    product.saleEnd,
    product.description,
    product.shortDescription,
    JSON.stringify(product.specs),
    product.stock,
    product.lowStockThreshold,
    product.trackInventory,
    product.allowBackorder,
    product.unit,
    product.badge,
    Number.isFinite(product.rating) ? product.rating : 4.5,
    Number.isFinite(product.reviews) ? product.reviews : 0,
    product.tone,
    product.image,
    JSON.stringify(product.images),
    product.active,
    product.status,
    product.seoTitle,
    product.seoDescription,
    product.slug,
    createdAt || updated,
    updated,
  )
}

function maybeDeleteImage(db, url, uploadsDir) {
  if (!url || !String(url).startsWith('/uploads/')) return
  const used = db.prepare('SELECT id, image, images FROM products').all().some((row) => {
    if (row.image === url) return true
    return asList(row.images).includes(url)
  })
  const cats = db.prepare('SELECT image FROM categories').all().some((row) => row.image === url)
  if (used || cats) return
  const file = join(uploadsDir, basename(url))
  if (existsSync(file)) {
    try {
      removeFile(file)
    } catch {
      /* keep file if locked */
    }
  }
}

function filterSort(db, query, settings) {
  const threshold = Number(settings.lowStockThreshold ?? 5)
  let rows = db.prepare('SELECT * FROM products').all()
  const q = String(query.q ?? '').trim().toLowerCase()
  const sku = String(query.sku ?? '').trim().toLowerCase()
  const barcode = String(query.barcode ?? '').trim().toLowerCase()
  const category = String(query.category ?? 'all')
  const brand = String(query.brand ?? 'all')
  const status = String(query.status ?? 'all')
  const stock = String(query.stock ?? 'all')
  if (q) {
    rows = rows.filter((row) => `${row.name} ${row.description || ''} ${row.short_description || ''} ${row.sku || ''}`.toLowerCase().includes(q))
  }
  if (sku) rows = rows.filter((row) => String(row.sku || '').toLowerCase().includes(sku))
  if (barcode) rows = rows.filter((row) => String(row.barcode || '').toLowerCase().includes(barcode))
  if (category !== 'all') rows = rows.filter((row) => row.category === category)
  if (brand !== 'all') rows = rows.filter((row) => (row.brand || '') === brand)
  if (status !== 'all') rows = rows.filter((row) => (row.status || (row.active === 1 ? 'active' : 'inactive')) === status)
  if (stock === 'in') rows = rows.filter((row) => row.stock > threshold)
  if (stock === 'low') rows = rows.filter((row) => row.stock > 0 && row.stock <= thresholdOf(settings, row))
  if (stock === 'out') rows = rows.filter((row) => row.stock <= 0)
  const sort = String(query.sort ?? 'updated')
  rows.sort((a, b) => {
    if (sort === 'name') return String(a.name).localeCompare(String(b.name), 'he')
    if (sort === 'name-desc') return String(b.name).localeCompare(String(a.name), 'he')
    if (sort === 'price') return Number(a.price) - Number(b.price)
    if (sort === 'price-desc') return Number(b.price) - Number(a.price)
    if (sort === 'stock') return Number(a.stock) - Number(b.stock)
    if (sort === 'stock-desc') return Number(b.stock) - Number(a.stock)
    const aTime = a.updated_at || a.created_at || ''
    const bTime = b.updated_at || b.created_at || ''
    return sort === 'updated' ? String(bTime).localeCompare(String(aTime)) : String(aTime).localeCompare(String(bTime))
  })
  return rows
}

function statsFrom(rows, settings) {
  const threshold = Number(settings.lowStockThreshold ?? 5)
  return {
    total: rows.length,
    active: rows.filter((row) => (row.status || (row.active === 1 ? 'active' : 'inactive')) === 'active').length,
    lowStock: rows.filter((row) => row.stock > 0 && row.stock <= thresholdOf(settings, row)).length,
    outOfStock: rows.filter((row) => row.stock <= 0).length,
    lowStockThreshold: threshold,
  }
}

export function registerProducts(app, { db, requireAdmin, upload, storedImage, uploadsDir }) {
  migrateProductSchema(db)

  app.use((req, _res, next) => {
    req.storedImage = storedImage
    next()
  })

  app.get('/api/admin/products/stats', requireAdmin, (_req, res) => {
    const settings = getSettings()
    res.json(statsFrom(db.prepare('SELECT * FROM products').all(), settings))
  })

  app.get('/api/admin/products/export.csv', requireAdmin, (req, res) => {
    const settings = getSettings()
    const rows = filterSort(db, req.query, settings).map((row) => mapProduct(row))
    const header = ['id', 'name', 'sku', 'barcode', 'brand', 'category', 'price', 'costPrice', 'salePrice', 'stock', 'status', 'unit', 'description']
    const lines = [header.join(',')]
    for (const product of rows) {
      const values = header.map((key) => `"${String(product[key] ?? '').replaceAll('"', '""')}"`)
      lines.push(values.join(','))
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="pro-pharm-products.csv"')
    res.send(`\uFEFF${lines.join('\n')}`)
  })

  app.get('/api/admin/products', requireAdmin, (req, res) => {
    const settings = getSettings()
    const all = db.prepare('SELECT * FROM products').all()
    const filtered = filterSort(db, req.query, settings)
    const pageSize = [20, 50, 100].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 20
    const page = Math.max(1, Number(req.query.page) || 1)
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize).map((row) => mapProduct(row, { usedInOrders: productUsed(db, row.id) }))
    res.json({
      items,
      total: filtered.length,
      page,
      pageSize,
      brands: [...new Set(all.map((row) => row.brand).filter(Boolean))],
      stats: statsFrom(all, settings),
    })
  })

  app.get('/api/admin/products/:id', requireAdmin, (req, res) => {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'המוצר לא נמצא' })
    res.json(mapProduct(row, { history: history(db, row.id), usedInOrders: productUsed(db, row.id) }))
  })

  app.post('/api/admin/uploads', requireAdmin, upload.array('files', 12), (req, res) => {
    try {
      const urls = (req.files || []).map((file) => storedImage(file))
      if (!urls.length) return res.status(400).json({ error: 'לא נבחרו תמונות' })
      res.json({ urls })
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'העלאה נכשלה' })
    }
  })

  app.post('/api/admin/products/import', requireAdmin, (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
    const errors = []
    let created = 0
    let updated = 0
    for (const [index, raw] of rows.entries()) {
      const name = String(raw.name ?? '').trim()
      const category = String(raw.category ?? '').trim()
      const price = Number(raw.price)
      const stock = Number(raw.stock)
      if (!name || !category || !Number.isFinite(price) || !Number.isInteger(stock)) {
        errors.push({ row: index + 1, error: 'חסרים שם, קטגוריה, מחיר או מלאי' })
        continue
      }
      const sku = String(raw.sku ?? '').trim()
      const existing = sku ? db.prepare('SELECT * FROM products WHERE sku = ? OR id = ?').get(sku, sku) : null
      const id = existing?.id || String(raw.id || `item-${Date.now().toString(36)}-${index}`).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
      try {
        const product = readProduct({ ...raw, name, category, price, stock }, asList(raw.images).length ? asList(raw.images) : existing ? asList(existing.images) : [])
        if (!product.sku) product.sku = id
        if (!product.slug) product.slug = id
        if (!product.images.length) product.images = [existing?.image || '/products/placeholder.svg']
        product.image = product.images[0]
        uniqueOrError(db, 'sku', product.sku, id)
        saveRow(db, id, product, existing?.created_at)
        logEvent(db, id, 'change', existing ? 'עודכן בייבוא CSV' : 'נוצר בייבוא CSV')
        if (existing) updated += 1
        else created += 1
      } catch (error) {
        errors.push({ row: index + 1, error: error instanceof Error ? error.message : 'שורה לא תקינה' })
      }
    }
    persistLive(db)
    res.json({ created, updated, errors, total: rows.length })
  })

  app.post('/api/admin/products/bulk', requireAdmin, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
    const action = String(req.body?.action || '')
    if (!ids.length) return res.status(400).json({ error: 'לא נבחרו מוצרים' })
    if (!['activate', 'deactivate', 'archive'].includes(action)) return res.status(400).json({ error: 'פעולה לא נתמכת' })
    const status = action === 'activate' ? 'active' : action === 'deactivate' ? 'inactive' : 'archived'
    const update = db.prepare('UPDATE products SET status = ?, active = ?, updated_at = ? WHERE id = ?')
    for (const id of ids) {
      update.run(status, status === 'active' ? 1 : 0, nowIso(), id)
      logEvent(db, id, 'change', action === 'activate' ? 'הופעל קבוצתית' : action === 'deactivate' ? 'הושבת קבוצתית' : 'הועבר לארכיון')
    }
    persistLive(db)
    res.json({ ok: true, count: ids.length, status })
  })

  app.post('/api/admin/products/:id/duplicate', requireAdmin, (req, res) => {
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
    const id = `item-${Date.now().toString(36)}`
    const copy = mapProduct(current)
    const product = readProduct(
      {
        ...copy,
        name: `${copy.name} (העתק)`,
        sku: `${copy.sku || copy.id}-copy`,
        slug: `${copy.slug || copy.id}-copy`,
        status: 'inactive',
        active: false,
        specs: (copy.specs || []).join('\n'),
      },
      copy.images?.length ? copy.images : [copy.image].filter(Boolean),
    )
    if (db.prepare('SELECT id FROM products WHERE sku = ?').get(product.sku)) product.sku = `${product.sku}-${randomBytes(2).toString('hex')}`
    saveRow(db, id, product)
    db.prepare('UPDATE products SET choices = ?, variants = ?, sizes = ?, colors = ? WHERE id = ?').run(
      current.choices || '{}',
      current.variants || '[]',
      current.sizes || '[]',
      current.colors || '[]',
      id,
    )
    logEvent(db, id, 'change', `שוכפל מ-${current.id}`)
    persistLive(db)
    res.status(201).json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)))
  })

  const saveUpload = upload.fields([
    { name: 'imageFile', maxCount: 1 },
    { name: 'imageFiles', maxCount: 12 },
    { name: 'files', maxCount: 12 },
  ])

  app.post('/api/admin/products', requireAdmin, saveUpload, (req, res) => {
    try {
      const images = collectImages(req)
      const product = readProduct(req.body, images)
      if (!validProduct(req.body, product)) return res.status(400).json({ error: 'חובה למלא שם, קטגוריה, מחיר וכמות' })
      let id = String(req.body.id || product.slug || product.sku || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '')
      if (!id) id = `item-${Date.now().toString(36)}`
      if (db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return res.status(400).json({ error: 'המזהה כבר קיים' })
      if (!product.sku) product.sku = id
      if (!product.slug) product.slug = slugify(product.seoTitle || product.name, id)
      uniqueOrError(db, 'sku', product.sku)
      uniqueOrError(db, 'slug', product.slug)
      if (product.barcode) uniqueOrError(db, 'barcode', product.barcode)
      saveRow(db, id, product)
      saveProductOptions(db, id, req.body)
      logEvent(db, id, 'change', product.status === 'draft' ? 'נשמר כטיוטה' : 'מוצר חדש נוצר')
      logEvent(db, id, 'inventory', `מלאי התחלתי ${product.stock}`)
      persistLive(db)
      res.status(201).json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)))
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'שמירה נכשלה' })
    }
  })

  app.patch('/api/admin/products/:id', requireAdmin, saveUpload, (req, res) => {
    try {
      const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
      if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
      const images = collectImages(req, asList(current.images).length ? asList(current.images) : [current.image].filter(Boolean))
      const product = readProduct(req.body, images)
      if (!validProduct(req.body, product)) return res.status(400).json({ error: 'חובה למלא שם, קטגוריה, מחיר וכמות' })
      if (!product.sku) product.sku = current.sku || current.id
      if (!product.slug) product.slug = current.slug || current.id
      uniqueOrError(db, 'sku', product.sku, current.id)
      uniqueOrError(db, 'slug', product.slug, current.id)
      if (product.barcode) uniqueOrError(db, 'barcode', product.barcode, current.id)
      const previousImages = asList(current.images)
      saveRow(db, current.id, product, current.created_at)
      saveProductOptions(db, current.id, req.body)
      const changes = []
      if (current.name !== product.name) changes.push(`שם: ${current.name} → ${product.name}`)
      if (Number(current.price) !== product.price) changes.push(`מחיר: ${current.price} → ${product.price}`)
      if (current.category !== product.category) changes.push(`קטגוריה: ${current.category} → ${product.category}`)
      if ((current.status || (current.active === 1 ? 'active' : 'inactive')) !== product.status) changes.push(`סטטוס: ${product.status}`)
      if (current.image !== product.image) changes.push('עודכנה תמונה ראשית')
      if (Number(current.stock) !== product.stock) {
        changes.push(`מלאי: ${current.stock} → ${product.stock}`)
        logEvent(db, current.id, 'inventory', `מלאי ${current.stock} → ${product.stock}`)
      }
      logEvent(db, current.id, 'change', changes.length ? changes.join(' · ') : 'נשמר ללא שינוי שדות עיקריים')
      for (const url of previousImages) {
        if (!images.includes(url)) maybeDeleteImage(db, url, uploadsDir)
      }
      persistLive(db)
      res.json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(current.id), { history: history(db, current.id) }))
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'שמירה נכשלה' })
    }
  })

  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
    if (productUsed(db, current.id)) {
      db.prepare("UPDATE products SET status = 'archived', active = 0, updated_at = ? WHERE id = ?").run(nowIso(), current.id)
      logEvent(db, current.id, 'change', 'הועבר לארכיון כי משויך להזמנות')
      persistLive(db)
      return res.json({ ok: true, archived: true })
    }
    const images = asList(current.images)
    db.prepare('DELETE FROM products WHERE id = ?').run(current.id)
    db.prepare('DELETE FROM product_events WHERE product_id = ?').run(current.id)
    for (const url of images) maybeDeleteImage(db, url, uploadsDir)
    persistLive(db)
    res.json({ ok: true, archived: false })
  })
}

export function publicCatalogProducts(db) {
  return db
    .prepare("SELECT * FROM products WHERE COALESCE(status, CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END) = 'active' ORDER BY updated_at DESC, rowid DESC")
    .all()
    .map(mapPublicProduct)
}
