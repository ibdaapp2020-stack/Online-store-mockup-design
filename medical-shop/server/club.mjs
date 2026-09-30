import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { hashPassword, mapOrder, verifyPassword } from './db.mjs'
import { persistLive } from './live-store.mjs'

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

function sessionSecret(db) {
  const admin = db.prepare('SELECT password_hash FROM admin WHERE id = 1').get()
  return admin?.password_hash || 'propharm-session'
}

export function signSession(db, role, extra = {}) {
  const payload = Buffer.from(JSON.stringify({ role, exp: Date.now() + 14 * 24 * 60 * 60 * 1000, ...extra })).toString('base64url')
  const sig = createHmac('sha256', sessionSecret(db)).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function readSession(db, token, role) {
  const text = String(token || '')
  const dot = text.lastIndexOf('.')
  if (dot < 1) return null
  const payload = text.slice(0, dot)
  const sig = text.slice(dot + 1)
  const expected = createHmac('sha256', sessionSecret(db)).update(payload).digest('base64url')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.role !== role || Number(data.exp) < Date.now()) return null
    return data
  } catch {
    return null
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(process.env.VERCEL),
    path: '/',
    maxAge: 14 * 24 * 60 * 60 * 1000,
  }
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
  const { smtpPass, variantsSeeded, variantStockReady, ...rest } = settings
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
    birthday: row.birthday || '',
    city: row.city || '',
    address: row.address || '',
    points: Number(row.points) || 0,
    nextPercent: Number(row.next_percent) || 0,
    couponCode: row.coupon_code || '',
    couponPercent: Number(row.coupon_percent) || 0,
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
    therapist: row.therapist || '',
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
    therapist: row.therapist || service?.therapist || '',
    status: row.status,
    createdAt: row.created_at,
  }
}

export function personalCoupon(db, req, code) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) return null
  const customer = customerFrom(req, db)
  if (!customer || String(customer.coupon_code || '').toUpperCase() !== normalized) return null
  const percent = Number(customer.coupon_percent) || 0
  if (percent <= 0) return null
  return { code: String(customer.coupon_code).toUpperCase(), percent }
}

function customerFrom(req, db) {
  const token = req.cookies?.medica_customer
  if (!token) return null
  const signed = readSession(db, token, 'customer')
  const session = signed ? null : db.prepare('SELECT token, customer_id FROM customer_sessions WHERE token = ?').get(token)
  const customerId = signed?.id || session?.customer_id
  if (!customerId) return null
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
}

function staffFrom(req, db) {
  const token = req.cookies?.medica_staff
  if (!token) return null
  const signed = readSession(db, token, 'staff')
  const session = signed ? null : db.prepare('SELECT token, employee_id FROM staff_sessions WHERE token = ?').get(token)
  const employeeId = signed?.id || session?.employee_id
  if (!employeeId) return null
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId)
  if (!employee || (employee.active !== 1 && employee.active !== true)) return null
  return employee
}

function jerusalemDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso))
}

function currentMonth() {
  return todayJerusalem().slice(0, 7)
}

function summarizePunches(punches, month) {
  const sorted = [...punches].sort((a, b) => String(a.at).localeCompare(String(b.at)))
  const shifts = []
  let open = null
  for (const punch of sorted) {
    if (punch.kind === 'in') open = punch
    else if (punch.kind === 'out' && open) {
      const span = Math.max(0, Math.round((new Date(punch.at).getTime() - new Date(open.at).getTime()) / 60000))
      shifts.push({ inAt: open.at, outAt: punch.at, minutes: span, date: jerusalemDate(open.at) })
      open = null
    }
  }
  const days = new Map()
  for (const shift of shifts.filter((item) => item.date.startsWith(month))) {
    const day = days.get(shift.date) || { date: shift.date, minutes: 0, shifts: [] }
    day.minutes += shift.minutes
    day.shifts.push({ inAt: shift.inAt, outAt: shift.outAt, minutes: shift.minutes })
    days.set(shift.date, day)
  }
  const listed = [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
  return {
    days: listed,
    totalMinutes: listed.reduce((sum, day) => sum + day.minutes, 0),
    openShift: open ? { at: open.at } : null,
    punches: sorted.filter((item) => jerusalemDate(item.at).startsWith(month)).reverse(),
  }
}

function payOf(employee, totalMinutes) {
  const payMode = employee.pay_mode === 'global' ? 'global' : 'hour'
  const hourlyRate = Number(employee.hourly_rate) || 0
  const globalPay = Number(employee.global_pay) || 0
  const salary = payMode === 'global' ? globalPay : Math.round((totalMinutes / 60) * hourlyRate)
  return { payMode, hourlyRate, globalPay, salary }
}

function mapCorrection(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    date: row.date,
    kind: row.kind,
    requestedAt: row.requested_at,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapEmployee(row) {
  const pay = payOf(row, 0)
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    active: row.active === 1 || row.active === true,
    payMode: pay.payMode,
    hourlyRate: pay.hourlyRate,
    globalPay: pay.globalPay,
  }
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
      created_at TEXT NOT NULL,
      birthday TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT ''
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
    `CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
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
  for (const sql of [
    "ALTER TABLE admin ADD COLUMN username TEXT DEFAULT 'admin'",
    "ALTER TABLE customers ADD COLUMN coupon_code TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE customers ADD COLUMN coupon_percent INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE services ADD COLUMN therapist TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE appointments ADD COLUMN therapist TEXT NOT NULL DEFAULT ''",
  ]) {
    try {
      db.exec(sql)
    } catch {
      /* column already exists */
    }
  }
  try {
    db.prepare("UPDATE admin SET username = 'admin' WHERE id = 1 AND (username IS NULL OR username = '')").run()
  } catch {
    /* username column is filled by default */
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
  for (const column of ["birthday TEXT NOT NULL DEFAULT ''", "city TEXT NOT NULL DEFAULT ''", "address TEXT NOT NULL DEFAULT ''"]) {
    try {
      db.exec(`ALTER TABLE customers ADD COLUMN ${column}`)
    } catch {
      /* column already exists */
    }
  }
  for (const column of ["choices TEXT NOT NULL DEFAULT '{}'", "variants TEXT NOT NULL DEFAULT '[]'"]) {
    try {
      db.exec(`ALTER TABLE products ADD COLUMN ${column}`)
    } catch {
      /* column already exists */
    }
  }
  try {
    db.exec("ALTER TABLE attendance ADD COLUMN note TEXT NOT NULL DEFAULT ''")
  } catch {
    /* column already exists */
  }
  for (const column of ["pay_mode TEXT NOT NULL DEFAULT 'hour'", 'hourly_rate REAL NOT NULL DEFAULT 0', 'global_pay REAL NOT NULL DEFAULT 0']) {
    try {
      db.exec(`ALTER TABLE employees ADD COLUMN ${column}`)
    } catch {
      /* column already exists */
    }
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
  for (const service of db.prepare('SELECT * FROM services').all()) {
    if (service.therapist) continue
    const therapist = service.id === 'consult' ? 'ד״ר אורתופדיה' : service.id === 'measure' ? 'מטפל מדרסים' : ''
    if (therapist) db.prepare('UPDATE services SET therapist = ? WHERE id = ?').run(therapist, service.id)
  }
  if (!db.prepare('SELECT * FROM employees WHERE username = ?').get('staff')) {
    db.prepare('INSERT INTO employees (id, name, username, password_hash, active) VALUES (?, ?, ?, ?, ?)').run(
      'emp-staff',
      'עובד חנות',
      'staff',
      '0f19529125fb7decd58ba3314f4fa92b:58027e09df3482b602d12f18fef5a70e32e9851dfa13b464acf8d9e1f15642a3',
      1,
    )
  }
  if (!db.prepare('SELECT * FROM customers WHERE email = ?').get('customer@propharm.shop')) {
    db.prepare(
      'INSERT INTO customers (id, name, phone, email, password_hash, points, next_percent, created_at, birthday, city, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      'cus-demo',
      'לקוח לדוגמה',
      '0501234567',
      'customer@propharm.shop',
      '68ef20584c0a37f7321b179349ee39eb:f2d321da2679aca5447dcb989aeca1d4f809fa9ce76fec7e54deda06dd53623b',
      120,
      0,
      new Date().toISOString(),
      '1990-05-12',
      'שגב שלום',
      'ח׳אלד בן אל-וליד',
    )
  }
  if (!settings.variantsSeeded) {
    for (const product of db.prepare('SELECT id FROM products').all()) {
      const sizes = SIZE_IDS.has(product.id) ? ['S', 'M', 'L', 'XL'] : []
      const colors = COLOR_IDS[product.id] ?? []
      if (sizes.length || colors.length) {
        db.prepare('UPDATE products SET sizes = ?, colors = ? WHERE id = ?').run(JSON.stringify(sizes), JSON.stringify(colors), product.id)
      }
    }
    writeSettings(db, { ...settings, variantsSeeded: true })
    settings.variantsSeeded = true
  }
  if (!readSettings(db)?.variantStockReady) {
    for (const product of db.prepare('SELECT * FROM products').all()) {
      if (readVariants(product).length) continue
      const sizes = asList(product.sizes)
      const colors = asList(product.colors)
      if (!sizes.length && !colors.length) continue
      const sizeValues = sizes.length ? sizes : ['']
      const colorValues = colors.length ? colors : ['']
      const rows = []
      for (const size of sizeValues) {
        for (const color of colorValues) rows.push({ size, color, other: '', stock: 0 })
      }
      const each = Math.floor(Number(product.stock || 0) / rows.length)
      rows.forEach((row, index) => {
        row.stock = each + (index === 0 ? Number(product.stock || 0) - each * rows.length : 0)
      })
      db.prepare('UPDATE products SET choices = ?, variants = ?, sizes = ?, colors = ?, stock = ? WHERE id = ?').run(
        JSON.stringify({ size: sizes.length > 0, color: colors.length > 0, other: false, otherLabel: 'אחר', others: [] }),
        JSON.stringify(rows),
        JSON.stringify(sizes),
        JSON.stringify(colors),
        rows.reduce((sum, row) => sum + row.stock, 0),
        product.id,
      )
    }
    writeSettings(db, { ...readSettings(db), variantStockReady: true })
  }
}

function splitList(value) {
  return String(value ?? '')
    .split(/[,،|\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function readChoices(product) {
  let raw = product.choices
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = null
    }
  }
  const sizes = asList(product.sizes)
  const colors = asList(product.colors)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { size: sizes.length > 0, color: colors.length > 0, other: false, otherLabel: 'אחר', others: [] }
  }
  return {
    size: Boolean(raw.size),
    color: Boolean(raw.color),
    other: Boolean(raw.other),
    otherLabel: String(raw.otherLabel || 'אחר'),
    others: asList(raw.others),
  }
}

function readVariants(product) {
  let raw = product.variants
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((row) => ({
    size: String(row.size || ''),
    color: String(row.color || ''),
    other: String(row.other || ''),
    stock: Math.max(0, Math.round(Number(row.stock) || 0)),
  }))
}

export function saveProductOptions(db, productId, body) {
  let incoming = body.choices
  if (typeof incoming === 'string' && incoming) {
    try {
      incoming = JSON.parse(incoming)
    } catch {
      incoming = null
    }
  }
  let variants = body.variants
  if (typeof variants === 'string' && variants) {
    try {
      variants = JSON.parse(variants)
    } catch {
      variants = []
    }
  }
  const choices = {
    size: Boolean(incoming?.size),
    color: Boolean(incoming?.color),
    other: Boolean(incoming?.other),
    otherLabel: String(incoming?.otherLabel || 'אחר').trim() || 'אחר',
    others: incoming?.other ? splitList(incoming.others ?? body.others) : [],
  }
  if (!incoming) {
    const sizes = splitList(body.sizes)
    const colors = splitList(body.colors)
    choices.size = sizes.length > 0
    choices.color = colors.length > 0
  }
  const sizes = choices.size ? splitList(body.sizes) : []
  const colors = choices.color ? splitList(body.colors) : []
  const rows = (Array.isArray(variants) ? variants : [])
    .map((row) => ({
      size: choices.size ? String(row.size || '') : '',
      color: choices.color ? String(row.color || '') : '',
      other: choices.other ? String(row.other || '') : '',
      stock: Math.max(0, Math.round(Number(row.stock) || 0)),
    }))
    .filter((row) => row.size || row.color || row.other)
  const stock = rows.reduce((sum, row) => sum + row.stock, 0)
  if (rows.length) {
    db.prepare('UPDATE products SET choices = ?, variants = ?, sizes = ?, colors = ?, stock = ? WHERE id = ?').run(
      JSON.stringify(choices),
      JSON.stringify(rows),
      JSON.stringify(sizes),
      JSON.stringify(colors),
      stock,
      productId,
    )
    return
  }
  db.prepare('UPDATE products SET choices = ?, variants = ?, sizes = ?, colors = ? WHERE id = ?').run(
    JSON.stringify(choices),
    '[]',
    JSON.stringify(sizes),
    JSON.stringify(colors),
    productId,
  )
}

export function lineOptions(product, line) {
  const choices = readChoices(product)
  const size = choices.size ? String(line.size ?? '').trim() : ''
  const color = choices.color ? String(line.color ?? '').trim() : ''
  const other = choices.other ? String(line.other ?? '').trim() : ''
  if (choices.size && !asList(product.sizes).includes(size)) throw new Error(`יש לבחור מידה אחת עבור ${product.name}`)
  if (choices.color && !asList(product.colors).includes(color)) throw new Error(`יש לבחור צבע אחד עבור ${product.name}`)
  if (choices.other && !choices.others.includes(other)) throw new Error(`יש לבחור ${choices.otherLabel} אחד עבור ${product.name}`)
  const variants = readVariants(product)
  if (variants.length) {
    const match = variants.find((row) => row.size === size && row.color === color && row.other === other)
    if (!match || match.stock < Number(line.qty)) throw new Error(`אין מספיק מלאי עבור ${product.name}`)
  }
  return {
    size: size || undefined,
    color: color || undefined,
    other: other || undefined,
    tracked: variants.length > 0,
    sizeValue: size,
    colorValue: color,
    otherValue: other,
  }
}

export function takeVariantStock(db, product, options, qty) {
  const next = readVariants(product).map((row) =>
    row.size === options.sizeValue && row.color === options.colorValue && row.other === options.otherValue ? { ...row, stock: row.stock - qty } : row,
  )
  db.prepare('UPDATE products SET variants = ?, stock = ? WHERE id = ?').run(
    JSON.stringify(next),
    next.reduce((sum, row) => sum + row.stock, 0),
    product.id,
  )
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
  res.cookie(name, token, cookieOptions())
}

export function writeSessionCookie(res, name, token) {
  cookie(res, name, token)
}

function clearRoleCookies(res) {
  for (const name of ['medica_admin', 'medica_customer', 'medica_staff']) res.clearCookie(name, { path: '/' })
}

export function registerClub(app, { db, requireAdmin }) {
  ensureSchema(db)

  app.get('/api/session', (req, res) => {
    const adminToken = req.cookies?.medica_admin
    if (adminToken && (readSession(db, adminToken, 'admin') || db.prepare('SELECT token FROM sessions WHERE token = ?').get(adminToken))) {
      return res.json({ role: 'admin' })
    }
    const staff = staffFrom(req, db)
    if (staff) return res.json({ role: 'staff', name: staff.name })
    const customer = customerFrom(req, db)
    if (customer) return res.json({ role: 'customer', customer: mapCustomer(customer) })
    res.json({ role: '' })
  })

  app.post('/api/session/login', (req, res) => {
    const login = String(req.body?.login ?? req.body?.username ?? req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    if (!login || !password) return res.status(401).json({ error: 'שם משתמש וסיסמה הם שדות חובה' })
    const admin = db.prepare('SELECT username, password_hash FROM admin WHERE id = 1').get()
    const adminName = String(admin?.username || 'admin').toLowerCase()
    if (admin && login === adminName && verifyPassword(password, admin.password_hash)) {
      clearRoleCookies(res)
      const token = signSession(db, 'admin')
      db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, new Date().toISOString())
      cookie(res, 'medica_admin', token)
      return res.json({ role: 'admin' })
    }
    const employee = db.prepare('SELECT * FROM employees WHERE username = ?').get(login)
    if (employee && (employee.active === 1 || employee.active === true) && verifyPassword(password, employee.password_hash)) {
      clearRoleCookies(res)
      const token = signSession(db, 'staff', { id: employee.id })
      db.prepare('INSERT INTO staff_sessions (token, employee_id, created_at) VALUES (?, ?, ?)').run(token, employee.id, new Date().toISOString())
      cookie(res, 'medica_staff', token)
      return res.json({ role: 'staff', name: employee.name })
    }
    const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(login)
    if (customer && verifyPassword(password, customer.password_hash)) {
      clearRoleCookies(res)
      const token = signSession(db, 'customer', { id: customer.id })
      db.prepare('INSERT INTO customer_sessions (token, customer_id, created_at) VALUES (?, ?, ?)').run(token, customer.id, new Date().toISOString())
      cookie(res, 'medica_customer', token)
      return res.json({ role: 'customer', customer: mapCustomer(customer) })
    }
    res.status(401).json({ error: 'שם המשתמש או הסיסמה שגויים' })
  })

  app.post('/api/account/coupon', (req, res) => {
    const found = personalCoupon(db, req, req.body?.code)
    if (!found) return res.status(404).json({ error: 'הקופון לא שייך לחשבון הזה' })
    res.json(found)
  })

  app.post('/api/account/register', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    const phone = String(req.body?.phone ?? '').trim()
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    const birthday = String(req.body?.birthday ?? '').trim()
    const city = String(req.body?.city ?? '').trim()
    const address = String(req.body?.address ?? '').trim()
    if (!name || !phone || !email.includes('@') || password.length < 4 || !birthday || !city || !address) {
      return res.status(400).json({ error: 'שם, טלפון, אימייל, יום הולדת, עיר, כתובת וסיסמה הם שדות חובה' })
    }
    if (db.prepare('SELECT * FROM customers WHERE email = ?').get(email)) {
      return res.status(400).json({ error: 'האימייל כבר רשום' })
    }
    const customerId = id('cus')
    db.prepare(
      'INSERT INTO customers (id, name, phone, email, password_hash, points, next_percent, created_at, birthday, city, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(customerId, name, phone, email, hashPassword(password), 0, 10, new Date().toISOString(), birthday, city, address)
    db.prepare('UPDATE customers SET coupon_code = ?, coupon_percent = ? WHERE id = ?').run('WELCOME10', 10, customerId)
    const token = signSession(db, 'customer', { id: customerId })
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
    const token = signSession(db, 'customer', { id: row.id })
    db.prepare('INSERT INTO customer_sessions (token, customer_id, created_at) VALUES (?, ?, ?)').run(token, row.id, new Date().toISOString())
    cookie(res, 'medica_customer', token)
    res.json(mapCustomer(row))
  })

  app.patch('/api/account/profile', (req, res) => {
    const row = customerFrom(req, db)
    if (!row) return res.status(401).json({ error: 'נדרשת כניסה' })
    const name = String(req.body?.name ?? row.name).trim()
    const phone = String(req.body?.phone ?? row.phone).trim()
    const birthday = String(req.body?.birthday ?? row.birthday ?? '').trim()
    const city = String(req.body?.city ?? row.city ?? '').trim()
    const address = String(req.body?.address ?? row.address ?? '').trim()
    if (!name || !phone || !city || !address) return res.status(400).json({ error: 'חסרים פרטים' })
    db.prepare('UPDATE customers SET name = ?, phone = ?, birthday = ?, city = ?, address = ? WHERE id = ?').run(
      name,
      phone,
      birthday,
      city,
      address,
      row.id,
    )
    res.json(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(row.id)))
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
    db.prepare('UPDATE appointments SET therapist = ? WHERE id = ?').run(service.therapist || '', appointmentId)
    res.status(201).json(mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId), [service]))
  })

  app.post('/api/staff/login', (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase()
    const row = db.prepare('SELECT * FROM employees WHERE username = ?').get(username)
    if (!row || (row.active !== 1 && row.active !== true) || !verifyPassword(String(req.body?.password ?? ''), row.password_hash)) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    }
    const token = signSession(db, 'staff', { id: row.id })
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
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : currentMonth()
    const summary = summarizePunches(punches, month)
    const last = punches[0] ? { kind: punches[0].kind, at: punches[0].at, lat: punches[0].lat, lng: punches[0].lng } : null
    const corrections = db
      .prepare('SELECT * FROM corrections')
      .all()
      .filter((item) => item.employee_id === row.id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    res.json({
      employee: { id: row.id, name: row.name, username: row.username },
      last,
      month,
      ...summary,
      remind: Boolean(last && last.kind === 'in' && Date.now() - new Date(last.at).getTime() >= 30 * 60 * 1000),
      corrections: corrections.map(mapCorrection),
    })
  })

  app.post('/api/staff/corrections', (req, res) => {
    const row = staffFrom(req, db)
    if (!row) return res.status(401).json({ error: 'נדרשת כניסת עובד' })
    const date = String(req.body?.date ?? '')
    const kind = req.body?.kind === 'out' ? 'out' : 'in'
    const time = String(req.body?.time ?? '')
    const note = String(req.body?.note ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || minutes(time) == null || !note) {
      return res.status(400).json({ error: 'תאריך, שעה והסבר הם שדות חובה' })
    }
    const correctionId = id('fix')
    db.prepare(
      'INSERT INTO corrections (id, employee_id, employee_name, date, kind, requested_at, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(correctionId, row.id, row.name, date, kind, `${date}T${time}:00+03:00`, note, 'pending', new Date().toISOString())
    res.status(201).json(mapCorrection(db.prepare('SELECT * FROM corrections WHERE id = ?').get(correctionId)))
  })

  app.post('/api/staff/punch', (req, res) => {
    const row = staffFrom(req, db)
    if (!row) return res.status(401).json({ error: 'נדרשת כניסת עובד' })
    const kind = req.body?.kind === 'out' ? 'out' : req.body?.kind === 'note' ? 'note' : 'in'
    const note = String(req.body?.note ?? '').trim()
    const date = String(req.body?.date ?? '')
    const time = String(req.body?.time ?? '')
    if (kind === 'note' && !note) return res.status(400).json({ error: 'חסרה הערה' })
    const lat = Number(req.body?.lat)
    const lng = Number(req.body?.lng)
    const point = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: null, lng: null }
    const at = kind === 'note' && /^\d{4}-\d{2}-\d{2}$/.test(date) && minutes(time) != null ? `${date}T${time}:00+03:00` : new Date().toISOString()
    db.prepare('INSERT INTO attendance (id, employee_id, employee_name, kind, at, lat, lng, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      id('att'),
      row.id,
      row.name,
      kind,
      at,
      point.lat,
      point.lng,
      note,
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
    db.prepare('UPDATE services SET therapist = ? WHERE id = ?').run(String(req.body?.therapist ?? '').trim(), serviceId)
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
    if (req.body?.therapist != null) {
      db.prepare('UPDATE services SET therapist = ? WHERE id = ?').run(String(req.body.therapist).trim(), current.id)
    }
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
    const current = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'התור לא נמצא' })
    const status = ['booked', 'done', 'cancelled', 'closed'].includes(req.body?.status) ? req.body.status : current.status
    const date = String(req.body?.date ?? current.date)
    const time = String(req.body?.time ?? current.time)
    const customerName = String(req.body?.customerName ?? current.customer_name).trim()
    const serviceId = String(req.body?.serviceId ?? current.service_id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || minutes(time) == null || !customerName) {
      return res.status(400).json({ error: 'חסרים פרטי תור' })
    }
    const clash = db
      .prepare('SELECT * FROM appointments')
      .all()
      .some((item) => item.id !== current.id && item.service_id === serviceId && item.date === date && item.time === time && item.status !== 'cancelled')
    if (clash) return res.status(400).json({ error: 'השעה הזו כבר תפוסה' })
    db.prepare('UPDATE appointments SET service_id = ?, customer_name = ?, date = ?, time = ?, status = ? WHERE id = ?').run(
      serviceId,
      customerName,
      date,
      time,
      status,
      current.id,
    )
    if (req.body?.therapist != null) {
      db.prepare('UPDATE appointments SET therapist = ? WHERE id = ?').run(String(req.body.therapist).trim(), current.id)
    }
    const services = db.prepare('SELECT * FROM services').all().map(mapService)
    res.json(mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(current.id), services))
  })

  app.post('/api/admin/appointments', requireAdmin, (req, res) => {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(String(req.body?.serviceId ?? ''))
    const date = String(req.body?.date ?? '')
    const time = String(req.body?.time ?? '')
    const closed = req.body?.status === 'closed'
    const customerName = String(req.body?.customerName ?? '').trim() || (closed ? 'סגור' : '')
    const phone = String(req.body?.phone ?? '').trim()
    if (!service || !/^\d{4}-\d{2}-\d{2}$/.test(date) || minutes(time) == null || !customerName || (!closed && !phone)) {
      return res.status(400).json({ error: 'שירות, תאריך, שעה, שם וטלפון הם שדות חובה' })
    }
    const clash = db
      .prepare('SELECT * FROM appointments')
      .all()
      .some((item) => item.service_id === service.id && item.date === date && item.time === time && item.status !== 'cancelled')
    if (clash) return res.status(400).json({ error: 'השעה הזו כבר תפוסה בשירות הזה' })
    let customerId = ''
    let createdPassword = ''
    if (req.body?.createCustomer) {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      const existing = email ? db.prepare('SELECT * FROM customers WHERE email = ?').get(email) : null
      if (existing) customerId = existing.id
      else {
        customerId = id('cus')
        createdPassword = String(req.body?.password ?? '').trim() || randomBytes(4).toString('hex')
        const finalEmail = email || `walkin.${customerId}@propharm.shop`
        db.prepare(
          'INSERT INTO customers (id, name, phone, email, password_hash, points, next_percent, created_at, birthday, city, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(customerId, customerName, phone, finalEmail, hashPassword(createdPassword), 0, 0, new Date().toISOString(), '', '', '')
      }
    }
    const appointmentId = id('apt')
    db.prepare(
      'INSERT INTO appointments (id, service_id, customer_id, customer_name, date, time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(appointmentId, service.id, customerId, customerName, date, time, closed ? 'closed' : 'booked', new Date().toISOString())
    db.prepare('UPDATE appointments SET therapist = ? WHERE id = ?').run(String(req.body?.therapist ?? service.therapist ?? '').trim(), appointmentId)
    const services = db.prepare('SELECT * FROM services').all().map(mapService)
    res.status(201).json({
      ...mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId), services),
      createdPassword,
    })
  })

  app.delete('/api/admin/appointments/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  })

  app.get('/api/admin/categories', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM categories').all().sort((a, b) => a.sort - b.sort))
  })

  app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    const blurb = String(req.body?.blurb ?? '').trim()
    if (!name) return res.status(400).json({ error: 'חסר שם קטגוריה' })
    const categoryId = id('cat')
    const sort = db.prepare('SELECT * FROM categories').all().reduce((max, row) => Math.max(max, Number(row.sort) || 0), -1) + 1
    db.prepare('INSERT INTO categories (id, name, blurb, sort) VALUES (?, ?, ?, ?)').run(categoryId, name, blurb || name, sort)
    persistLive(db)
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId))
  })

  app.patch('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'הקטגוריה לא נמצאה' })
    const name = String(req.body?.name ?? current.name).trim()
    const blurb = String(req.body?.blurb ?? current.blurb).trim()
    if (!name) return res.status(400).json({ error: 'חסר שם קטגוריה' })
    db.prepare('UPDATE categories SET name = ?, blurb = ? WHERE id = ?').run(name, blurb, current.id)
    persistLive(db)
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(current.id))
  })

  app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const used = db.prepare('SELECT id FROM products WHERE category = ?').all(req.params.id)
    if (used.length) return res.status(400).json({ error: 'יש מוצרים בקטגוריה. העבירו אותם לפני המחיקה' })
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id)
    persistLive(db)
    res.json({ ok: true })
  })

  app.get('/api/admin/customers', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM customers').all().map(mapCustomer))
  })

  app.post('/api/admin/customers/:id/coupon', requireAdmin, (req, res) => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id)
    if (!customer) return res.status(404).json({ error: 'הלקוח לא נמצא' })
    const percent = Math.min(100, Math.max(1, Math.round(Number(req.body?.percent) || 10)))
    const code = `PH${randomBytes(3).toString('hex').toUpperCase()}`
    db.prepare('UPDATE customers SET coupon_code = ?, coupon_percent = ? WHERE id = ?').run(code, percent, customer.id)
    res.json(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id)))
  })

  app.get('/api/admin/employees', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM employees').all().map(mapEmployee))
  })

  app.patch('/api/admin/employees/:id', requireAdmin, (req, res) => {
    const current = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'העובד לא נמצא' })
    const payMode = req.body?.payMode === 'global' ? 'global' : 'hour'
    const hourlyRate = Math.max(0, Number(req.body?.hourlyRate) || 0)
    const globalPay = Math.max(0, Number(req.body?.globalPay) || 0)
    db.prepare('UPDATE employees SET pay_mode = ?, hourly_rate = ?, global_pay = ? WHERE id = ?').run(payMode, hourlyRate, globalPay, current.id)
    res.json(mapEmployee(db.prepare('SELECT * FROM employees WHERE id = ?').get(current.id)))
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

  app.get('/api/admin/attendance', requireAdmin, (req, res) => {
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : currentMonth()
    const punches = db.prepare('SELECT * FROM attendance').all()
    const corrections = db.prepare('SELECT * FROM corrections').all().map(mapCorrection).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    const employees = db.prepare('SELECT * FROM employees').all().map((employee) => {
      const own = punches.filter((item) => item.employee_id === employee.id)
      const summary = summarizePunches(own, month)
      const pay = payOf(employee, summary.totalMinutes)
      const history = own
        .filter((item) => jerusalemDate(item.at).startsWith(month))
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .map((item) => ({ id: item.id, kind: item.kind, at: item.at, note: item.note || '', lat: item.lat, lng: item.lng }))
      return { ...mapEmployee(employee), ...summary, ...pay, month, history }
    })
    res.json({ month, employees, corrections })
  })

  app.patch('/api/admin/corrections/:id', requireAdmin, (req, res) => {
    const current = db.prepare('SELECT * FROM corrections WHERE id = ?').get(req.params.id)
    if (!current) return res.status(404).json({ error: 'הבקשה לא נמצאה' })
    const status = req.body?.status === 'approved' ? 'approved' : req.body?.status === 'rejected' ? 'rejected' : ''
    if (!status || current.status !== 'pending') return res.status(400).json({ error: 'אפשר לאשר או לדחות רק בקשה שממתינה' })
    if (status === 'approved') {
      db.prepare('INSERT INTO attendance (id, employee_id, employee_name, kind, at, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id('att'),
        current.employee_id,
        current.employee_name,
        current.kind,
        current.requested_at,
        null,
        null,
      )
    }
    db.prepare('UPDATE corrections SET status = ? WHERE id = ?').run(status, current.id)
    res.json(mapCorrection(db.prepare('SELECT * FROM corrections WHERE id = ?').get(current.id)))
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
