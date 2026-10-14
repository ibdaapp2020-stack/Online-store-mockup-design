import { randomBytes } from 'node:crypto'
import { adminSettings, nextSettings, publicSettings } from './club.mjs'
import { firebaseStatus } from './firebase.mjs'
import { repo } from './firebase-repo.mjs'

function statusOf(product) {
  return product.status || (product.active === false ? 'inactive' : 'active')
}

function filterProducts(rows, query, settings) {
  const threshold = Number(settings.lowStockThreshold ?? 5)
  const q = String(query.q ?? '').trim().toLowerCase()
  const sku = String(query.sku ?? '').trim().toLowerCase()
  const barcode = String(query.barcode ?? '').trim().toLowerCase()
  let next = [...rows]
  if (q) next = next.filter((row) => `${row.name} ${row.description || ''} ${row.shortDescription || ''} ${row.sku || ''}`.toLowerCase().includes(q))
  if (sku) next = next.filter((row) => String(row.sku || '').toLowerCase().includes(sku))
  if (barcode) next = next.filter((row) => String(row.barcode || '').toLowerCase().includes(barcode))
  if (query.category && query.category !== 'all') next = next.filter((row) => row.category === query.category)
  if (query.brand && query.brand !== 'all') next = next.filter((row) => row.brand === query.brand)
  if (query.status && query.status !== 'all') next = next.filter((row) => statusOf(row) === query.status)
  if (query.stock === 'in') next = next.filter((row) => row.stock > threshold)
  if (query.stock === 'low') next = next.filter((row) => row.stock > 0 && row.stock <= (row.lowStockThreshold ?? threshold))
  if (query.stock === 'out') next = next.filter((row) => row.stock <= 0)
  return next
}

function statsFrom(rows, settings) {
  const threshold = Number(settings.lowStockThreshold ?? 5)
  return {
    total: rows.length,
    active: rows.filter((row) => statusOf(row) === 'active').length,
    lowStock: rows.filter((row) => row.stock > 0 && row.stock <= (row.lowStockThreshold ?? threshold)).length,
    outOfStock: rows.filter((row) => row.stock <= 0).length,
    lowStockThreshold: threshold,
  }
}

export async function verifyFirebaseAdmin(req) {
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const store = repo()
  const decoded = await store.firebase.auth.verifyIdToken(token)
  if (!(await store.isAdminUid(decoded.uid))) return null
  return decoded
}

export function registerFirebaseApi(app, { requireAdmin, upload }) {
  app.get('/api/admin/firebase/status', (_req, res) => {
    res.json(firebaseStatus())
  })

  app.get('/api/catalog', async (_req, res) => {
    try {
      const store = repo()
      const [categories, products, settings] = await Promise.all([store.all('categories'), store.publicProducts(), store.settings()])
      categories.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      res.json({ categories, products, settings: publicSettings(settings) })
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'קטלוג Firebase נכשל' })
    }
  })

  app.get('/api/orders/track/:id', async (req, res) => {
    const order = await repo().get('orders', req.params.id)
    if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' })
    res.json(order)
  })

  app.post('/api/orders', async (req, res) => {
    try {
      const store = repo()
      const customer = req.body?.customer ?? {}
      const lines = Array.isArray(req.body?.items) ? req.body.items : []
      if (!customer.name || !customer.phone || !customer.city || !customer.address || !lines.length) {
        return res.status(400).json({ error: 'חסרים פרטי הזמנה' })
      }
      const settings = await store.settings()
      const products = await store.all('products')
      const items = []
      const stockUpdates = []
      for (const line of lines) {
        const product = products.find((item) => item.id === line.productId && statusOf(item) === 'active')
        const qty = Number(line.qty)
        if (!product || !Number.isInteger(qty) || qty < 1) throw new Error('מוצר לא זמין')
        items.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          qty,
          size: line.size,
          color: line.color,
          other: line.other,
        })
        stockUpdates.push({
          id: product.id,
          qty,
          allowEmpty: Boolean(settings.allowSellWithoutStock),
        })
      }
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
      const discount = 0
      const shipping = subtotal === 0 || subtotal >= Number(settings.freeFrom || 0) ? 0 : Number(settings.shippingFee || 0)
      const order = {
        id: `MED-${Date.now().toString().slice(-8)}`,
        createdAt: new Date().toISOString(),
        status: 'received',
        customer: { name: customer.name, phone: customer.phone, city: customer.city, address: customer.address },
        items,
        subtotal,
        discount,
        shipping,
        total: subtotal - discount + shipping,
        coupon: req.body?.coupon || null,
        idempotencyKey: req.body?.idempotencyKey || null,
      }
      const saved = await store.createOrderAtomic(order, stockUpdates)
      res.status(saved.duplicate ? 200 : 201).json(saved)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'לא ניתן לקלוט את ההזמנה' })
    }
  })

  app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
    const store = repo()
    const [orders, products, customers, appointments, employees] = await Promise.all([
      store.all('orders'),
      store.all('products'),
      store.all('customers'),
      store.all('appointments'),
      store.all('employees'),
    ])
    const settings = await store.settings()
    const threshold = Number(settings.lowStockThreshold ?? 5)
    res.json({
      orders: orders.length,
      revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      open: orders.filter((order) => order.status !== 'delivered').length,
      products: products.length,
      customers: customers.length,
      appointments: appointments.filter((item) => item.status === 'booked').length,
      employees: employees.length,
      lowStock: products.filter((product) => product.stock > 0 && product.stock <= threshold).sort((a, b) => a.stock - b.stock),
      recent: orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6),
    })
  })

  app.get('/api/admin/products', requireAdmin, async (req, res) => {
    const store = repo()
    const [all, settings, orders] = await Promise.all([store.all('products'), store.settings(), store.all('orders')])
    const used = new Set(orders.flatMap((order) => (order.items || []).map((item) => item.productId)))
    const filtered = filterProducts(all, req.query, settings)
    const pageSize = [20, 50, 100].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 20
    const page = Math.max(1, Number(req.query.page) || 1)
    res.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map((item) => ({ ...item, usedInOrders: used.has(item.id) })),
      total: filtered.length,
      page,
      pageSize,
      brands: [...new Set(all.map((item) => item.brand).filter(Boolean))],
      stats: statsFrom(all, settings),
    })
  })

  app.get('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const store = repo()
    const product = await store.get('products', req.params.id)
    if (!product) return res.status(404).json({ error: 'המוצר לא נמצא' })
    const events = (await store.all('productEvents')).filter((item) => item.productId === product.id)
    res.json({ ...product, history: events })
  })

  app.post('/api/admin/uploads', requireAdmin, upload.array('files', 12), async (req, res) => {
    try {
      const store = repo()
      const urls = []
      for (const file of req.files || []) {
        const path = `products/uploads/${Date.now()}-${randomBytes(4).toString('hex')}-${file.originalname}`
        urls.push(await store.uploadBuffer(path, file.buffer, file.mimetype || 'image/png'))
      }
      if (!urls.length) return res.status(400).json({ error: 'לא נבחרו תמונות' })
      res.json({ urls })
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'העלאה נכשלה' })
    }
  })

  async function readProduct(req, current) {
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()
    const store = repo()
    const uploaded = []
    for (const file of files) {
      uploaded.push(await store.uploadBuffer(`products/${current?.id || 'new'}/${Date.now()}-${file.originalname}`, file.buffer, file.mimetype || 'image/png'))
    }
    let images = []
    try {
      images = JSON.parse(req.body.images || '[]')
    } catch {
      images = []
    }
    if (!Array.isArray(images)) images = []
    images = [...images, ...uploaded].filter(Boolean)
    const status = req.body.status || (req.body.active === 'false' ? 'inactive' : 'active')
    return {
      name: String(req.body.name || '').trim(),
      sku: String(req.body.sku || '').trim(),
      barcode: String(req.body.barcode || '').trim(),
      brand: String(req.body.brand || '').trim(),
      category: String(req.body.category || '').trim(),
      subcategory: String(req.body.subcategory || '').trim(),
      price: Number(req.body.price),
      compareAt: req.body.compareAt === '' ? null : Number(req.body.compareAt || 0) || null,
      costPrice: req.body.costPrice === '' ? null : Number(req.body.costPrice),
      salePrice: req.body.salePrice === '' ? null : Number(req.body.salePrice),
      saleStart: req.body.saleStart || null,
      saleEnd: req.body.saleEnd || null,
      description: String(req.body.description || '').trim(),
      shortDescription: String(req.body.shortDescription || '').trim(),
      specs: String(req.body.specs || '').split('\n').map((line) => line.trim()).filter(Boolean),
      stock: Number(req.body.stock),
      unit: req.body.unit || 'יח׳',
      status,
      active: status === 'active',
      image: images[0] || '/products/placeholder.svg',
      images: images.length ? images : ['/products/placeholder.svg'],
      updatedAt: new Date().toISOString(),
    }
  }

  const saveUpload = upload.fields([
    { name: 'imageFile', maxCount: 1 },
    { name: 'imageFiles', maxCount: 12 },
    { name: 'files', maxCount: 12 },
  ])

  app.post('/api/admin/products', requireAdmin, saveUpload, async (req, res) => {
    const store = repo()
    const product = await readProduct(req)
    if (!product.name || !product.category || !Number.isFinite(product.price)) {
      return res.status(400).json({ error: 'חובה למלא שם, קטגוריה, מחיר וכמות' })
    }
    const id = String(req.body.id || product.sku || store.nextId('item'))
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
    if (await store.get('products', id)) return res.status(400).json({ error: 'המזהה כבר קיים' })
    const saved = await store.set('products', id, { ...product, id, createdAt: new Date().toISOString() })
    res.status(201).json(saved)
  })

  app.patch('/api/admin/products/:id', requireAdmin, saveUpload, async (req, res) => {
    const store = repo()
    const current = await store.get('products', req.params.id)
    if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
    const product = await readProduct(req, current)
    const saved = await store.set('products', current.id, { ...current, ...product, id: current.id })
    res.json(saved)
  })

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const store = repo()
    const current = await store.get('products', req.params.id)
    if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
    const orders = await store.all('orders')
    if (orders.some((order) => (order.items || []).some((item) => item.productId === current.id))) {
      await store.set('products', current.id, { ...current, status: 'archived', active: false })
      return res.json({ ok: true, archived: true })
    }
    await store.remove('products', current.id)
    res.json({ ok: true, archived: false })
  })

  app.post('/api/admin/products/:id/duplicate', requireAdmin, async (req, res) => {
    const store = repo()
    const current = await store.get('products', req.params.id)
    if (!current) return res.status(404).json({ error: 'המוצר לא נמצא' })
    const id = store.nextId('item')
    const saved = await store.set('products', id, {
      ...current,
      id,
      name: `${current.name} (העתק)`,
      sku: `${current.sku || current.id}-copy`,
      status: 'inactive',
      active: false,
    })
    res.status(201).json(saved)
  })

  app.get('/api/admin/categories', requireAdmin, async (_req, res) => {
    const store = repo()
    const [categories, products] = await Promise.all([store.all('categories'), store.all('products')])
    res.json(
      categories
        .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
        .map((category) => ({ ...category, productCount: products.filter((item) => item.category === category.id).length })),
    )
  })

  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    const store = repo()
    const name = String(req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'חסר שם קטגוריה' })
    const id = store.nextId('cat')
    const categories = await store.all('categories')
    const saved = await store.set('categories', id, {
      id,
      name,
      blurb: String(req.body?.blurb || name).trim(),
      image: req.body?.image || null,
      sort: categories.reduce((max, row) => Math.max(max, Number(row.sort) || 0), -1) + 1,
    })
    res.status(201).json(saved)
  })

  app.patch('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    const store = repo()
    const current = await store.get('categories', req.params.id)
    if (!current) return res.status(404).json({ error: 'הקטגוריה לא נמצאה' })
    const saved = await store.set('categories', current.id, {
      ...current,
      name: String(req.body?.name ?? current.name).trim(),
      blurb: String(req.body?.blurb ?? current.blurb).trim(),
      image: req.body?.image == null ? current.image : req.body.image,
    })
    res.json(saved)
  })

  app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    const store = repo()
    const products = await store.all('products')
    if (products.some((product) => product.category === req.params.id)) {
      return res.status(400).json({ error: 'יש מוצרים בקטגוריה. העבירו אותם לפני המחיקה' })
    }
    await store.remove('categories', req.params.id)
    res.json({ ok: true })
  })

  app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
    const orders = await repo().all('orders')
    res.json(orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))))
  })

  app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const store = repo()
    const current = await store.get('orders', req.params.id)
    if (!current) return res.status(404).json({ error: 'ההזמנה לא נמצאה' })
    const saved = await store.set('orders', current.id, { ...current, status: req.body.status })
    res.json(saved)
  })

  app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
    res.json(adminSettings(await repo().settings()))
  })

  app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
    const store = repo()
    const next = nextSettings(await store.settings(), req.body)
    res.json(adminSettings(await store.saveSettings(next)))
  })

  app.get('/api/admin/customers', requireAdmin, async (_req, res) => {
    const rows = await repo().all('customers')
    res.json(rows.map((row) => ({ ...row, password_hash: undefined })))
  })

  app.get('/api/admin/employees', requireAdmin, async (_req, res) => {
    const rows = await repo().all('employees')
    res.json(rows.map((row) => ({ ...row, password_hash: undefined })))
  })

  app.get('/api/admin/services', requireAdmin, async (_req, res) => {
    res.json(await repo().all('services'))
  })

  app.get('/api/admin/appointments', requireAdmin, async (_req, res) => {
    res.json(await repo().all('appointments'))
  })

  app.get('/api/admin/attendance', requireAdmin, async (_req, res) => {
    res.json(await repo().all('attendance'))
  })

  app.get('/api/admin/mail', requireAdmin, async (_req, res) => {
    res.json(await repo().all('mailLog'))
  })
}
