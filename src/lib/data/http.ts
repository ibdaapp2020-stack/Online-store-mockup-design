import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { currentUser, getRole, loginAccount, loginAdmin, logoutAuth, registerCustomer, requireAdmin } from './auth'
import {
  db,
  getProduct,
  getSettings,
  listCategories,
  listOrders,
  listProducts,
  removeCategory,
  removeProduct,
  saveCategory,
  saveProduct,
  settingsFrom,
  uploadImage,
} from './core'
import { findStoreOrder } from './orders'
import { emailAdminFetch, notifyOrderStatus, notifyStockChange } from '../notify'
import type { Badge, Product } from '../../types'

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function bodyOf(init?: RequestInit) {
  if (!init?.body) return {} as Record<string, unknown>
  if (typeof init.body === 'string') return JSON.parse(init.body) as Record<string, unknown>
  if (init.body instanceof FormData) return Object.fromEntries(init.body.entries())
  return {} as Record<string, unknown>
}

function parseChoices(raw: unknown) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return { size: false, color: false, other: false, otherLabel: 'אחר', others: [] }
    }
  }
  return raw || { size: false, color: false, other: false, otherLabel: 'אחר', others: [] }
}

function parseVariants(raw: unknown) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }
  return Array.isArray(raw) ? raw : []
}

async function productFromForm(body: Record<string, unknown>, image: string, id: string): Promise<Product> {
  const specs = String(body.specs ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    id,
    name: String(body.name ?? '').trim(),
    category: String(body.category ?? '').trim(),
    price: Number(body.price),
    compareAt: body.compareAt === '' || body.compareAt == null ? undefined : Number(body.compareAt),
    description: String(body.description ?? '').trim(),
    specs,
    stock: Number(body.stock),
    badge: body.badge ? (String(body.badge) as Badge) : undefined,
    rating: Number(body.rating) || 4.5,
    reviews: Number(body.reviews) || 0,
    tone: String(body.tone || '#0f766e'),
    image,
    active: body.active === 'false' || body.active === false ? false : true,
    sizes: String(body.sizes || '')
      .split(/[,،|]/)
      .map((item) => item.trim())
      .filter(Boolean),
    colors: String(body.colors || '')
      .split(/[,،|]/)
      .map((item) => item.trim())
      .filter(Boolean),
    choices: parseChoices(body.choices),
    variants: parseVariants(body.variants),
  }
}

function fail(message: string): never {
  throw new Error(message)
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (path.startsWith('/api/admin/email') || path.startsWith('/api/notify')) {
    return emailAdminFetch<T>(path, init)
  }
  const method = (init?.method || 'GET').toUpperCase()
  const url = new URL(path, 'http://local.propharm')
  const parts = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/admin/login' && method === 'POST') {
    const body = await bodyOf(init)
    const result = await loginAdmin(String(body.username ?? body.login ?? body.email ?? ''), String(body.password ?? ''))
    return { ok: true, role: result.role } as T
  }
  if (url.pathname === '/api/admin/logout' && method === 'POST') {
    await logoutAuth()
    return { ok: true } as T
  }
  if (url.pathname === '/api/admin/me') {
    await requireAdmin()
    return { ok: true } as T
  }

  await requireAdmin()

  if (url.pathname === '/api/admin/stats') {
    const [orders, products, customers, appointments, employees] = await Promise.all([
      listOrders(),
      listProducts(),
      getDocs(collection(db(), 'customers')),
      getDocs(collection(db(), 'appointments')),
      getDocs(collection(db(), 'employees')),
    ])
    const daily = []
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)
      const rows = orders.filter((order) => order.createdAt.slice(0, 10) === date)
      daily.push({ date: date.slice(5), total: rows.reduce((sum, order) => sum + order.total, 0), count: rows.length })
    }
    const pipeline = { received: 0, packing: 0, shipped: 0, delivered: 0 }
    for (const order of orders) {
      if (pipeline[order.status] != null) pipeline[order.status] += 1
    }
    return {
      orders: orders.length,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      open: orders.filter((order) => order.status !== 'delivered').length,
      products: products.length,
      customers: customers.size,
      appointments: appointments.docs.filter((item) => item.data().status === 'booked').length,
      employees: employees.size,
      lowStock: products.filter((product) => product.active && product.stock <= 5).sort((a, b) => a.stock - b.stock),
      recent: orders.slice(0, 6),
      daily,
      pipeline,
    } as T
  }

  if (url.pathname === '/api/admin/products' && method === 'GET') return (await listProducts()) as T
  if (url.pathname === '/api/admin/products' && method === 'POST') {
    const raw = await bodyOf(init)
    const id = slug(String(raw.id || raw.name || '')) || `item-${Date.now().toString(36)}`
    if (await getProduct(id)) fail('המזהה כבר קיים')
    let image = String(raw.image || '')
    const file = init?.body instanceof FormData ? init.body.get('imageFile') : null
    if (file instanceof File && file.size) image = await uploadImage(`products/${id}/${file.name}`, file)
    const product = await productFromForm(raw, image, id)
    if (!product.name || !product.category || !Number.isFinite(product.price) || !Number.isInteger(product.stock)) {
      fail('חובה למלא שם, קטגוריה, מחיר וכמות')
    }
    await saveProduct({ ...product, createdAt: new Date().toISOString() } as Product)
    return (await getProduct(id)) as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'products' && parts[3] && method === 'GET') {
    return ((await getProduct(parts[3])) ?? fail('המוצר לא נמצא')) as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'products' && parts[3] && method === 'PATCH') {
    const current = await getProduct(parts[3])
    if (!current) fail('המוצר לא נמצא')
    const raw = await bodyOf(init)
    let image = String(raw.image || current.image || '')
    const file = init?.body instanceof FormData ? init.body.get('imageFile') : null
    if (file instanceof File && file.size) image = await uploadImage(`products/${parts[3]}/${file.name}`, file)
    const product = await productFromForm(raw, image, parts[3])
    if (!product.name || !product.category || !Number.isFinite(product.price) || !Number.isInteger(product.stock)) {
      fail('חובה למלא שם, קטגוריה, מחיר וכמות')
    }
    await saveProduct(product)
    void notifyStockChange({ productId: parts[3], name: product.name, previous: current.stock, next: product.stock })
    return (await getProduct(parts[3])) as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'products' && parts[3] && method === 'DELETE') {
    await removeProduct(parts[3])
    return { ok: true } as T
  }

  if (url.pathname === '/api/admin/categories' && method === 'GET') return (await listCategories()) as T
  if (url.pathname === '/api/admin/categories' && method === 'POST') {
    const raw = await bodyOf(init)
    const name = String(raw.name || '').trim()
    if (!name) fail('חסר שם קטגוריה')
    const rows = await listCategories()
    const id = slug(name) || `cat-${Date.now().toString(36)}`
    const sort = rows.reduce((max, row) => Math.max(max, row.sort || 0), -1) + 1
    await saveCategory({ id, name, blurb: String(raw.blurb || name).trim(), sort, active: true })
    return { id, name, blurb: String(raw.blurb || name).trim(), sort } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'categories' && parts[3] && method === 'PATCH') {
    const rows = await listCategories()
    const current = rows.find((item) => item.id === parts[3])
    if (!current) fail('הקטגוריה לא נמצאה')
    const raw = await bodyOf(init)
    const name = String(raw.name ?? current.name).trim()
    if (!name) fail('חסר שם קטגוריה')
    const next = { ...current, name, blurb: String(raw.blurb ?? current.blurb).trim() }
    await saveCategory(next)
    return next as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'categories' && parts[3] && method === 'DELETE') {
    await removeCategory(parts[3])
    return { ok: true } as T
  }

  if (url.pathname === '/api/admin/orders' && method === 'GET') return (await listOrders()) as T
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'orders' && parts[3] && method === 'PATCH') {
    const raw = await bodyOf(init)
    await updateDoc(doc(db(), 'orders', parts[3]), { status: raw.status })
    const updated = await findStoreOrder(parts[3])
    void notifyOrderStatus(updated)
    return updated as T
  }

  if (url.pathname === '/api/admin/settings' && method === 'GET') return (await getSettings()) as T
  if (url.pathname === '/api/admin/settings' && method === 'PATCH') {
    const raw = await bodyOf(init)
    const current = await getSettings()
    const next = {
      ...current,
      ...raw,
      shippingFee: Number(raw.shippingFee ?? current.shippingFee),
      freeFrom: Number(raw.freeFrom ?? current.freeFrom),
      couponPercent: Number(raw.couponPercent ?? current.couponPercent),
      pointsPer100: Number(raw.pointsPer100 ?? current.pointsPer100),
      clubPercent: Number(raw.clubPercent ?? current.clubPercent),
      showBanner: Boolean(raw.showBanner),
    }
    delete (next as { smtpPass?: string }).smtpPass
    await setDoc(doc(db(), 'settings', 'store'), next, { merge: true })
    return settingsFrom(next) as T
  }

  if (url.pathname === '/api/admin/services' && method === 'GET') {
    const snap = await getDocs(collection(db(), 'services'))
    return snap.docs.map((item) => ({ id: item.id, ...item.data() })) as T
  }
  if (url.pathname === '/api/admin/services' && method === 'POST') {
    const raw = await bodyOf(init)
    const ref = await addDoc(collection(db(), 'services'), { ...raw, active: true })
    return { id: ref.id, ...raw, active: true } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'services' && parts[3] && method === 'PATCH') {
    const raw = await bodyOf(init)
    await setDoc(doc(db(), 'services', parts[3]), raw, { merge: true })
    return { id: parts[3], ...raw } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'services' && parts[3] && method === 'DELETE') {
    await deleteDoc(doc(db(), 'services', parts[3]))
    return { ok: true } as T
  }

  if (url.pathname === '/api/admin/appointments' && method === 'GET') {
    const snap = await getDocs(collection(db(), 'appointments'))
    return snap.docs.map((item) => ({ id: item.id, ...item.data() })) as T
  }
  if (url.pathname === '/api/admin/appointments' && method === 'POST') {
    const raw = await bodyOf(init)
    const id = `apt-${Date.now().toString(36)}`
    await setDoc(doc(db(), 'appointments', id), { id, ...raw, createdAt: new Date().toISOString() })
    return { id, ...raw } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'appointments' && parts[3] && method === 'PATCH') {
    const raw = await bodyOf(init)
    await setDoc(doc(db(), 'appointments', parts[3]), raw, { merge: true })
    return { id: parts[3], ...raw } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'appointments' && parts[3] && method === 'DELETE') {
    await deleteDoc(doc(db(), 'appointments', parts[3]))
    return { ok: true } as T
  }

  if (url.pathname === '/api/admin/customers' && method === 'GET') {
    const snap = await getDocs(collection(db(), 'customers'))
    return snap.docs.map((item) => ({ id: item.id, ...item.data() })) as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'customers' && parts[4] === 'coupon' && method === 'POST') {
    const raw = await bodyOf(init)
    await setDoc(doc(db(), 'customers', parts[3]), { couponCode: raw.code, couponPercent: Number(raw.percent) || 0 }, { merge: true })
    const snap = await getDoc(doc(db(), 'customers', parts[3]))
    return { id: parts[3], ...snap.data() } as T
  }

  if (url.pathname === '/api/admin/employees' && method === 'GET') {
    const snap = await getDocs(collection(db(), 'employees'))
    return snap.docs.map((item) => ({ id: item.id, ...item.data() })) as T
  }
  if (url.pathname === '/api/admin/employees' && method === 'POST') {
    const raw = await bodyOf(init)
    const id = `emp-${Date.now().toString(36)}`
    await setDoc(doc(db(), 'employees', id), { id, ...raw, active: true })
    return { id, ...raw, active: true } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'employees' && parts[3] && method === 'PATCH') {
    const raw = await bodyOf(init)
    await setDoc(doc(db(), 'employees', parts[3]), raw, { merge: true })
    return { id: parts[3], ...raw } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'employees' && parts[3] && method === 'DELETE') {
    await deleteDoc(doc(db(), 'employees', parts[3]))
    return { ok: true } as T
  }

  if (url.pathname === '/api/admin/attendance') {
    const month = url.searchParams.get('month') || ''
    const employees = await getDocs(collection(db(), 'employees'))
    const corrections = await getDocs(collection(db(), 'corrections'))
    return {
      employees: employees.docs.map((item) => ({ id: item.id, ...item.data() })),
      corrections: corrections.docs
        .map((item) => ({ id: item.id, ...(item.data() as { date?: string }) }))
        .filter((item) => !month || String(item.date || '').startsWith(month)),
    } as T
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'corrections' && parts[3] && method === 'PATCH') {
    const raw = await bodyOf(init)
    await setDoc(doc(db(), 'corrections', parts[3]), raw, { merge: true })
    return { id: parts[3], ...raw } as T
  }
  if (url.pathname === '/api/admin/mail') {
    const snap = await getDocs(collection(db(), 'mailLog'))
    return snap.docs.map((item) => ({ id: item.id, ...item.data() })) as T
  }

  fail('הנתיב לא נתמך')
}

export async function accountFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const url = new URL(path, 'http://local.propharm')
  const body = await bodyOf(init)

  if (url.pathname === '/api/session') {
    const user = currentUser()
    if (!user) return {} as T
    return { role: (await getRole(user.uid))?.toLowerCase() } as T
  }
  if (url.pathname === '/api/session/login' && method === 'POST') {
    const result = await loginAccount(String(body.login ?? body.email ?? ''), String(body.password ?? ''))
    return { role: result.role.toLowerCase() } as T
  }
  if (url.pathname === '/api/account/register' && method === 'POST') {
    await registerCustomer({
      email: String(body.email ?? body.login ?? ''),
      password: String(body.password ?? ''),
      name: String(body.name ?? ''),
      phone: String(body.phone ?? ''),
      city: String(body.city ?? ''),
      address: String(body.address ?? ''),
      birthday: String(body.birthday ?? ''),
    })
    return { ok: true } as T
  }
  if (url.pathname === '/api/account/logout' && method === 'POST') {
    await logoutAuth()
    return { ok: true } as T
  }
  if (url.pathname === '/api/account/me') {
    const user = currentUser()
    if (!user) fail('נדרשת כניסה')
    const customer = await getDoc(doc(db(), 'customers', user.uid))
    const orders = (await listOrders()).filter((order) => order.customer.customerId === user.uid)
    const appointments = (await getDocs(collection(db(), 'appointments'))).docs
      .map((item) => ({ id: item.id, ...(item.data() as { customerId?: string }) }))
      .filter((item) => item.customerId === user.uid)
    return { customer: { id: user.uid, ...customer.data() }, orders, appointments } as T
  }
  if (url.pathname === '/api/account/coupon' && method === 'POST') {
    const user = currentUser()
    if (!user) fail('צריך להיות מחוברים כלקוח')
    const customer = await getDoc(doc(db(), 'customers', user.uid))
    const code = String(body.code || '').toUpperCase()
    const data = customer.data()
    if (!data || String(data.couponCode || '').toUpperCase() !== code) fail('הקוד לא מוכר, או שהוא שייך לחשבון אחר. צריך להיות מחוברים כלקוח.')
    return { code: data.couponCode, percent: Number(data.couponPercent) || 0 } as T
  }
  if (url.pathname === '/api/services') {
    const snap = await getDocs(collection(db(), 'services'))
    return snap.docs
      .map((item) => ({ id: item.id, ...(item.data() as { active?: boolean }) }))
      .filter((item) => item.active !== false) as T
  }
  if (partsPath(url.pathname, ['api', 'services', '*', 'slots'])) {
    const serviceId = url.pathname.split('/')[3]
    const date = url.searchParams.get('date') || ''
    const serviceSnap = await getDoc(doc(db(), 'services', serviceId))
    if (!serviceSnap.exists()) fail('שירות או תאריך לא תקינים')
    const taken = new Set(
      (await getDocs(collection(db(), 'appointments'))).docs
        .filter((item) => item.data().serviceId === serviceId && item.data().date === date && item.data().status !== 'cancelled')
        .map((item) => String(item.data().time)),
    )
    return slotsFor({ ...serviceSnap.data(), id: serviceSnap.id }, date, taken) as T
  }
  if (url.pathname === '/api/account/appointments' && method === 'POST') {
    const user = currentUser()
    if (!user) fail('כדי לקבוע תור צריך להיכנס לאזור האישי')
    const customer = await getDoc(doc(db(), 'customers', user.uid))
    const id = `apt-${Date.now().toString(36)}`
    await setDoc(doc(db(), 'appointments', id), {
      id,
      serviceId: body.serviceId,
      customerId: user.uid,
      customerName: customer.data()?.name || '',
      date: body.date,
      time: body.time,
      status: 'booked',
      createdAt: new Date().toISOString(),
    })
    return { id } as T
  }
  fail('הנתיב לא נתמך')
}

export async function staffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const url = new URL(path, 'http://local.propharm')
  const body = await bodyOf(init)
  const user = currentUser()
  if (url.pathname === '/api/staff/logout') {
    await logoutAuth()
    return { ok: true } as T
  }
  if (!user) fail('נדרשת כניסת צוות')
  if (url.pathname === '/api/staff/me') {
    const employees = await getDocs(collection(db(), 'employees'))
    const mine = employees.docs.find((item) => item.data().authUid === user.uid || item.id === user.uid)
    const punches = (await getDocs(collection(db(), 'attendance'))).docs.map((item) => ({ id: item.id, ...item.data() }))
    return { employee: mine ? { id: mine.id, ...mine.data() } : { id: user.uid, name: user.email }, punches } as T
  }
  if (url.pathname === '/api/staff/punch' && method === 'POST') {
    await addDoc(collection(db(), 'attendance'), {
      employeeId: user.uid,
      employeeName: user.email,
      kind: body.kind,
      at: new Date().toISOString(),
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    })
    return { ok: true } as T
  }
  if (url.pathname === '/api/staff/corrections' && method === 'POST') {
    await addDoc(collection(db(), 'corrections'), {
      employeeId: user.uid,
      employeeName: user.email,
      date: body.date,
      kind: body.kind,
      requestedAt: new Date().toISOString(),
      note: body.note || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
    return { ok: true } as T
  }
  fail('הנתיב לא נתמך')
}

function partsPath(path: string, pattern: string[]) {
  const parts = path.split('/').filter(Boolean)
  return pattern.every((item, index) => item === '*' || item === parts[index])
}

function minutes(value: string) {
  const match = String(value).match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function clock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function slotsFor(service: DocumentLike, date: string, taken: Set<string>) {
  const start = minutes(String(service.openTime || '09:00'))
  const end = minutes(String(service.closeTime || '17:00'))
  const step = Number(service.slotMinutes) || 30
  const days = Array.isArray(service.days) ? service.days.map(Number) : [0, 1, 2, 3, 4]
  const weekday = new Date(`${date}T12:00:00+03:00`).getUTCDay()
  if (start == null || end == null || !days.includes(weekday)) return []
  const slots: string[] = []
  for (let time = start; time + step <= end; time += step) {
    const label = clock(time)
    if (!taken.has(label)) slots.push(label)
  }
  return slots
}

type DocumentLike = Record<string, unknown>
