import { randomBytes } from 'node:crypto'
import { hashPassword, mapOrder, verifyPassword } from './db.mjs'

const DAYS = [0, 1, 2, 3, 4, 5, 6]
const SIZE_IDS = new Set(['back', 'knee', 'ankle', 'bandage'])
const COLOR_IDS = {
  insole: ['שחור', 'כחול', 'אפור'],
  masks: ['כחול', 'לבן'],
  plasters: ['שקוף', 'גוון עור'],
}

export function asList(value) {
  if (Array.isArray(value)) return value.map(String)
  if (value == null || value === '') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
}

function todayJerusalem() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

function weekday(date) {
  return new Date(`${date}T12:00:00+03:00`).getUTCDay()
}

function minutes(value) {
  const match = String(value).match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function clock(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function readSettings(db) {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get()
  return row ? JSON.parse(row.data) : null
}

function writeSettings(db, settings) {
  db.prepare('UPDATE settings SET data = ? WHERE id = 1').run(JSON.stringify(settings))
}

export function publicSettings(settings) {
  const { smtpPass, variantsSeeded, ...rest } = settings
  return rest
}

export function adminSettings(settings) {
  return { ...publicSettings(settings), smtpPass: '', smtpConfigured: Boolean(settings.smtpPass) }
}

export function nextSettings(current, body) {
  const mode = body.loyaltyMode === 'percent' ? 'percent' : 'points'
  const smtpPass = String(body.smtpPass ?? '').trim()
  return {
    ...current,
    storeName: String(body.storeName ?? current.storeName).trim(),
    tagline: String(body.tagline ?? current.tagline).trim(),
    banner: String(body.banner ?? current.banner),
    showBanner: Boolean(body.showBanner),
    disclaimer: String(body.disclaimer ?? current.disclaimer).trim(),
    shippingFee: Number(body.shippingFee),
    freeFrom: Number(body.freeFrom),
    couponCode: String(body.couponCode ?? current.couponCode).trim().toUpperCase(),
    couponPercent: Number(body.couponPercent),
    paymentNote: String(body.paymentNote ?? current.paymentNote).trim(),
    loyaltyMode: mode,
    pointsPer100: Math.max(0, Math.round(Number(body.pointsPer100) || 0)),
    clubPercent: Math.min(100, Math.max(0, Math.round(Number(body.clubPercent) || 0))),
    notifyEmail: String(body.notifyEmail ?? current.notifyEmail ?? '').trim(),
    smtpUser: String(body.smtpUser ?? current.smtpUser ?? '').trim(),
    smtpPass: smtpPass || current.smtpPass || '',
  }
}

function mapCustomer(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    points: Number(row.points) || 0,
    nextPercent: Number(row.next_percent) || 0,
  }
}

function mapService(row) {
  return {
    id: row.id,
    name: row.name,
    days: asList(row.days).map(Number),
    openTime: row.open_time,
    closeTime: row.close_time,
    slotMinutes: Number(row.slot_minutes) || 30,
    active: row.active === 1 || row.active === true,
  }
}

function mapAppointment(row, services) {
  const service = services.find((item) => item.id === row.service_id)
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: service?.name || row.service_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    date: row.date,
    time: row.time,
    status: row.status,
    createdAt: row.created_at,
  }
}

function customerFrom(req, db) {
  const token = req.cookies?.medica_customer
  if (!token) return null
  const session = db.prepare('SELECT token, customer_id FROM customer_sessions WHERE token = ?').get(token)
  if (!session) return null
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(session.customer_id)
}

function staffFrom(req, db) {
  const token = req.cookies?.medica_staff
  if (!token) return null
  const session = db.prepare('SELECT token, employee_id FROM staff_sessions WHERE token = ?').get(token)
  if (!session) return null
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(session.employee_id)
  if (!employee || employee.active !== 1) return null
  return employee
}

function slotsFor(service, date, taken) {
  const day = weekday(date)
  if (!service.days.includes(day)) return []
  const start = minutes(service.openTime)
  const end = minutes(service.closeTime)
  if (start == null || end == null || end <= start) return []
  const open = []
  for (let cursor = start; cursor + service.slotMinutes <= end; cursor += service.slotMinutes) {
    const time = clock(cursor)
    if (!taken.has(time)) open.push(time)
  }
  return open
}

function ensureSchema(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      next_percent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS customer_sessions (
      token TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      days TEXT NOT NULL,
      open_time TEXT NOT NULL,
      close_time TEXT NOT NULL,
      slot_minutes INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS staff_sessions (
      token TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      at TEXT NOT NULL,
      lat REAL,
      lng REAL
    )`,
    `CREATE TABLE IF NOT EXISTS mail_log (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      to_email TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ]
  for (const sql of statements) {
    try {
      db.exec(sql)
    } catch {
      /* json store ignores table SQL */
    }
  }
  try {
    db.exec("ALTER TABLE products ADD COLUMN sizes TEXT NOT NULL DEFAULT '[]'")
  } catch {
    /* column already exists */
  }
  try {
    db.exec("ALTER TABLE products ADD COLUMN colors TEXT NOT NULL DEFAULT '[]'")
  } catch {
    /* column already exists */
  }

  const settings = readSettings(db)
  if (!settings) return
  if (!db.prepare('SELECT * FROM services').all().length) {
    const insert = db.prepare(
      'INSERT INTO services (id, name, days, open_time, close_time, slot_minutes, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    insert.run('measure', 'מדידת מדרסים', JSON.stringify([0, 1, 2, 3, 4]), '09:00', '17:00', 30, 1)
    insert.run('consult', 'ייעוץ אורתופדי', JSON.stringify([0, 2, 4]), '10:00', '16:00', 45, 1)
  }
  if (settings.variantsSeeded) return
  for (const product of db.prepare('SELECT id FROM products').all()) {
    const sizes = SIZE_IDS.has(product.id) ? ['S', 'M', 'L', 'XL'] : []
    const colors = COLOR_IDS[product.id] ?? []
    if (sizes.length || colors.length) {
      db.prepare('UPDATE products SET sizes = ?, colors = ? WHERE id = ?').run(JSON.stringify(sizes), JSON.stringify(colors), product.id)
    }
  }
  writeSettings(db, { ...settings, variantsSeeded: true })
}

export function saveProductOptions(db, productId, body) {
  const sizes = String(body.sizes ?? '')
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const colors = String(body.colors ?? '')
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
  db.prepare('UPDATE products SET sizes = ?, colors = ? WHERE id = ?').run(JSON.stringify(sizes), JSON.stringify(colors), productId)
}

export function lineOptions(product, line) {
  const sizes = asList(product.sizes)
  const colors = asList(product.colors)
  const size = String(line.size ?? '').trim()
  const color = String(line.color ?? '').trim()
  if (sizes.length && !sizes.includes(size)) throw new Error(`יש לבחור מידה עבור ${product.name}`)
  if (colors.length && !colors.includes(color)) throw new Error(`יש לבחור צבע עבור ${product.name}`)
  return { size: size || undefined, color: color || undefined }
}

export function applyClubDiscount(db, req, priced, settings) {
  const row = customerFrom(req, db)
  const customer = mapCustomer(row)
  let discount = priced.discount
  if (customer && settings.loyaltyMode === 'percent' && customer.nextPercent > 0) {
    discount += Math.round(priced.subtotal * (customer.nextPercent / 100))
  }
  discount = Math.min(discount, priced.subtotal)
  return {
    priced: { ...priced, discount, total: priced.subtotal - discount + priced.shipping },
    customerId: customer?.id,
  }
}

async function sendMail(settings, order) {
  const to = settings.notifyEmail || 'propharm2026@gmail.com'
  const lines = order.items
    .map((item) => `${item.name}${item.size ? ` מידה ${item.size}` : ''}${item.color ? ` צבע ${item.color}` : ''} × ${item.qty} — ${item.price * item.qty} ₪`)
    .join('\n')
  const text = [
    `הזמנה חדשה ${order.id}`,
    `לקוח: ${order.customer.name}`,
    `טלפון: ${order.customer.phone}`,
    `עיר: ${order.customer.city}`,
    `כתובת: ${order.customer.address}`,
    '',
    lines,
    '',
    `סה״כ: ${order.total} ₪`,
  ].join('\n')
  if (!settings.smtpPass) {
    return { status: 'skipped', detail: 'חסרה סיסמת אפליקציה של Gmail בהגדרות' }
  }
  try {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: settings.smtpUser || to, pass: settings.smtpPass },
    })
    await transport.sendMail({
      from: settings.smtpUser || to,
      to,
      subject: `הזמנה חדשה ${order.id} — PRO PHARM`,
      text,
    })
    return { status: 'sent', detail: `נשלח אל ${to}` }
  } catch (error) {
    return { status: 'failed', detail: error instanceof Error ? error.message : 'שליחת המייל נכשלה' }
  }
}

export async function settleClub(db, req, order, settings) {
  const row = customerFrom(req, db)
  if (row) {
    if (settings.loyaltyMode === 'points') {
      const earned = Math.round(order.total * ((Number(settings.pointsPer100) || 0) / 100))
      db.prepare('UPDATE customers SET points = ?, next_percent = ? WHERE id = ?').run((Number(row.points) || 0) + earned, 0, row.id)
    } else {
      db.prepare('UPDATE customers SET points = ?, next_percent = ? WHERE id = ?').run(
        Number(row.points) || 0,
        Number(settings.clubPercent) || 0,
        row.id,
      )
    }
  }
  const mail = await sendMail(settings, order)
  db.prepare('INSERT INTO mail_log (id, order_id, to_email, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id('mail'),
    order.id,
    settings.notifyEmail || 'propharm2026@gmail.com',
    mail.status,
    mail.detail,
    new Date().toISOString(),
  )
  return mail
}

function cookie(res, name, token) {
  res.cookie(name, token, { httpOnly: true, sameSite: 'lax', path: '/' })
}

export function registerClub(app, { db, requireAdmin }) {
  ensureSchema(db)

  app.post('/api/account/register', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    const phone = String(req.body?.phone ?? '').trim()
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    if (!name || !phone || !email.includes('@') || password.length < 4) {
      return res.status(400).json({ error: 'שם, טלפון, אימייל וסיסמה (לפחות 4 תווים) הם שדות חובה' })
    }
    if (db.prepare('SELECT * FROM customers WHERE email = ?').get(email)) {
      return res.status(400).json({ error: 'האימייל כבר רשום' })
    }
    const customerId = id('cus')
    db.prepare(
      'INSERT INTO customers (id, name, phone, email, password_hash, points, next_percent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(customerId, name, phone, email, hashPassword(password), 0, 0, new Date().toISOString())
    const token = randomBytes(24).toString('hex')
    db.prepare('INSERT INTO customer_sessions (token, customer_id, created_at) VALUES (?, ?, ?)').run(token, customerId, new Date().toISOString())
    cookie(res, 'medica_customer', token)
    res.status(201).json(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)))
  })

  app.post('/api/account/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const row = db.prepare('SELECT * FROM customers WHERE email = ?').get(email)
    if (!row || !verifyPassword(String(req.body?.password ?? ''), row.password_hash)) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' })
    }
    const token = randomBytes(24).toString('hex')
    db.prepare('INSERT INTO customer_sessions (token, customer_id, created_at) VALUES (?, ?, ?)').run(token, row.id, new Date().toISOString())
    cookie(res, 'medica_customer', token)
    res.json(mapCustomer(row))
  })

  app.post('/api/account/logout', (req, res) => {
    if (req.cookies?.medica_customer) db.prepare('DELETE FROM customer_sessions WHERE token = ?').run(req.cookies.medica_customer)
    res.clearCookie('medica_customer', { path: '/' })
    res.json({ ok: true })
  })

  app.get('/api/account/me', (req, res) => {
    const row = customerFrom(req, db)
    if (!row) return res.status(401).json({ error: 'נדרשת כניסה' })
    const services = db.prepare('SELECT * FROM services').all().map(mapService)
    const appointments = db
      .prepare('SELECT * FROM appointments')
      .all()
      .map((item) => mapAppointment(item, services))
      .filter((item) => item.customerId === row.id)
    const orders = db
      .prepare('SELECT * FROM orders')
      .all()
      .map(mapOrder)
      .filter((order) => order.customer?.customerId === row.id)
    res.json({ customer: mapCustomer(row), appointments, orders })
  })

  app.get('/api/services', (_req, res) => {
    res.json(db.prepare('SELECT * FROM services').all().map(mapService).filter((service) => service.active))
  })

  app.get('/api/services/:id/slots', (req, res) => {
    const service = db
      .prepare('SELECT * FROM services')
      .all()
      .map(mapService)
      .find((item) => item.id === req.params.id && item.active)
    const date = String(req.query.date ?? '')
    if (!service || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'שירות או תאריך לא תקינים' })
    const taken = new Set(
      db
        .prepare('SELECT * FROM appointments')
        .all()
        .filter((item) => item.service_id === service.id && item.date === date && item.status !== 'cancelled')
        .map((item) => item.time),
    )
    res.json(slotsFor(service, date, taken))
  })

  app.post('/api/account/appointments', (req, res) => {
    const row = customerFrom(req, db)
    if (!row) return res.status(401).json({ error: 'כדי לקבוע תור צריך להיכנס לאזור האישי' })
    const service = db
      .prepare('SELECT * FROM services')
      .all()
      .map(mapService)
      .find((item) => item.id === req.body?.serviceId && item.active)
    const date = String(req.body?.date ?? '')
    const time = String(req.body?.time ?? '')
    if (!service || date < todayJerusalem()) return res.status(400).json({ error: 'אי אפשר לקבוע תור לתאריך הזה' })
    const taken = new Set(
      db
        .prepare('SELECT * FROM appointments')
        .all()
        .filter((item) => item.service_id === service.id && item.date === date && item.status !== 'cancelled')
        .map((item) => item.time),
    )
    if (!slotsFor(service, date, taken).includes(time)) return res.status(400).json({ error: 'השעה לא פנויה' })
    const appointmentId = id('apt')
    db.prepare(
      'INSERT INTO appointments (id, service_id, customer_id, customer_name, date, time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(appointmentId, service.id, row.id, row.name, date, time, 'booked', new Date().toISOString())
    res.status(201).json(mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId), [service]))
  })

  app.post('/api/staff/login', (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase()
    const row = db.prepare('SELECT * FROM employees WHERE username = ?').get(username)
    if (!row || row.active !== 1 || !verifyPassword(String(req.body?.password ?? ''), row.password_hash)) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    }
    const token = randomBytes(24).toString('hex')
    db.prepare('INSERT INTO staff_sessions (token, employee_id, created_at) VALUES (?, ?, ?)').run(token, row.id, new Date().toISOString())
    cookie(res, 'medica_staff', token)
    res.json({ id: row.id, name: row.name, username: row.username })
  })

  app.post('/api/staff/logout', (req, res) => {
    if (req.cookies?.medica_staff) db.prepare('DELETE FROM staff_sessions WHERE token = ?').run(req.cookies.medica_staff)
    res.clearCookie('medica_staff', { path: '/' })
    res.json({ ok: true })
  })

  app.get('/api/staff/me', (req, res) => {
    const row = staffFrom(req, db)
    if (!row) return res.status(401).json({ error: 'נדרשת כניסת עובד' })
    const punches = db
      .prepare('SELECT * FROM attendance')
      .all()
      .filter((item) => item.employee_id === row.id)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    res.json({
      employee: { id: row.id, name: row.name, username: row.username },
      last: punches[0] ? { kind: punches[0].kind, at: punches[0].at, lat: punches[0].lat, lng: punches[0].lng } : null,
    })
  })

  app.post('/api/staff/punch', (req, res) => {
    const row = staffFrom(req, db)
    if (!row) return res.status(401).json({ error: 'נדרשת כניסת עובד' })
    const kind = req.body?.kind === 'out' ? 'out' : 'in'
    const lat = Number(req.body?.lat)
    const lng = Number(req.body?.lng)
    const point = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: null, lng: null }
    db.prepare('INSERT INTO attendance (id, employee_id, employee_name, kind, at, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id('att'),
      row.id,
      row.name,
      kind,
      new Date().toISOString(),
      point.lat,
      point.lng,
    )
    res.status(201).json({ ok: true, located: point.lat != null })
  })

  app.get('/api/admin/services', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM services').all().map(mapService))
  })

  app.post('/api/admin/services', requireAdmin, (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    const days = asList(req.body?.days).map(Number).filter((day) => DAYS.includes(day))
    const openTime = String(req.body?.openTime ?? '')
    const closeTime = String(req.body?.closeTime ?? '')
    const slotMinutes = Number(req.body?.slotMinutes)
    if (!name || !days.length || minutes(openTime) == null || minutes(closeTime) == null || !Number.isInteger(slotMinutes) || slotMinutes < 10) {
      return res.status(400).json({ error: 'חסרים פרטי שירות' })
    }
    const serviceId = id('srv')
    db.prepare('INSERT INTO services (id, name, days, open_time, close_time, slot_minutes, active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      serviceId,
      name,
      JSON.stringify(days),
      openTime,
      closeTime,
      slotMinutes,
      req.body?.active === false ? 0 : 1,
    )
    res.status(201).json(mapService(db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId)))
  })

  app.patch('/api/admin/services/:id', requireAdmin, (req, res) => {
    const current = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'השירות לא נמצא' })
    const name = String(req.body?.name ?? current.name).trim()
    const days = asList(req.body?.days ?? asList(current.days)).map(Number).filter((day) => DAYS.includes(day))
    const openTime = String(req.body?.openTime ?? current.open_time)
    const closeTime = String(req.body?.closeTime ?? current.close_time)
    const slotMinutes = Number(req.body?.slotMinutes ?? current.slot_minutes)
    db.prepare('UPDATE services SET name = ?, days = ?, open_time = ?, close_time = ?, slot_minutes = ?, active = ? WHERE id = ?').run(
      name,
      JSON.stringify(days),
      openTime,
      closeTime,
      slotMinutes,
      req.body?.active === false ? 0 : 1,
      current.id,
    )
    res.json(mapService(db.prepare('SELECT * FROM services WHERE id = ?').get(current.id)))
  })

  app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  })

  app.get('/api/admin/appointments', requireAdmin, (_req, res) => {
    const services = db.prepare('SELECT * FROM services').all().map(mapService)
    res.json(
      db
        .prepare('SELECT * FROM appointments')
        .all()
        .map((item) => mapAppointment(item, services))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    )
  })

  app.patch('/api/admin/appointments/:id', requireAdmin, (req, res) => {
    const status = ['booked', 'done', 'cancelled'].includes(req.body?.status) ? req.body.status : ''
    const current = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id)
    if (!current || !status) return res.status(400).json({ error: 'התור לא נמצא' })
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, current.id)
    const services = db.prepare('SELECT * FROM services').all().map(mapService)
    res.json(mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(current.id), services))
  })

  app.get('/api/admin/customers', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM customers').all().map(mapCustomer))
  })

  app.get('/api/admin/employees', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM employees').all().map((row) => ({ id: row.id, name: row.name, username: row.username, active: row.active === 1 })))
  })

  app.post('/api/admin/employees', requireAdmin, (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    const username = String(req.body?.username ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    if (!name || !username || password.length < 4) return res.status(400).json({ error: 'שם, שם משתמש וסיסמה (לפחות 4 תווים) הם שדות חובה' })
    if (db.prepare('SELECT * FROM employees WHERE username = ?').get(username)) return res.status(400).json({ error: 'שם המשתמש תפוס' })
    const employeeId = id('emp')
    db.prepare('INSERT INTO employees (id, name, username, password_hash, active) VALUES (?, ?, ?, ?, ?)').run(
      employeeId,
      name,
      username,
      hashPassword(password),
      1,
    )
    res.status(201).json({ id: employeeId, name, username, active: true })
  })

  app.delete('/api/admin/employees/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  })

  app.get('/api/admin/attendance', requireAdmin, (_req, res) => {
    res.json(
      db
        .prepare('SELECT * FROM attendance')
        .all()
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .map((row) => ({
          id: row.id,
          employeeName: row.employee_name,
          kind: row.kind,
          at: row.at,
          lat: row.lat,
          lng: row.lng,
        })),
    )
  })

  app.get('/api/admin/mail', requireAdmin, (_req, res) => {
    res.json(
      db
        .prepare('SELECT * FROM mail_log')
        .all()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((row) => ({ id: row.id, orderId: row.order_id, to: row.to_email, status: row.status, detail: row.detail, createdAt: row.created_at })),
    )
  })
}
