import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, setDoc } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { loadEnvFiles } from './load-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFiles(root)

const dryRun = process.argv.includes('--dry-run')
const dbFile = join(root, 'data', 'shop.db')

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function readSqlite() {
  if (!existsSync(dbFile)) throw new Error(`SQLite not found: ${dbFile}`)
  const sqlite = new DatabaseSync(dbFile, { readOnly: true })
  try {
    const categories = sqlite.prepare('SELECT * FROM categories ORDER BY sort').all()
    const products = sqlite.prepare('SELECT * FROM products').all()
    const settings = sqlite.prepare('SELECT data FROM settings WHERE id = 1').get()
    const orders = sqlite.prepare('SELECT * FROM orders').all()
    let customers = []
    let services = []
    let appointments = []
    let employees = []
    let attendance = []
    let corrections = []
    let mail = []
    try {
      customers = sqlite.prepare('SELECT * FROM customers').all()
    } catch {
      /* table may not exist */
    }
    try {
      services = sqlite.prepare('SELECT * FROM services').all()
    } catch {
      /* optional */
    }
    try {
      appointments = sqlite.prepare('SELECT * FROM appointments').all()
    } catch {
      /* optional */
    }
    try {
      employees = sqlite.prepare('SELECT * FROM employees').all()
    } catch {
      /* optional */
    }
    try {
      attendance = sqlite.prepare('SELECT * FROM attendance').all()
    } catch {
      /* optional */
    }
    try {
      corrections = sqlite.prepare('SELECT * FROM corrections').all()
    } catch {
      /* optional */
    }
    try {
      mail = sqlite.prepare('SELECT * FROM mail_log').all()
    } catch {
      /* optional */
    }
    return { categories, products, settings, orders, customers, services, appointments, employees, attendance, corrections, mail }
  } finally {
    sqlite.close()
  }
}

function localImagePath(image, productId) {
  const value = String(image || `/products/${productId}.png`)
  if (value.startsWith('http') || value.startsWith('data:')) return null
  const relative = value.startsWith('/') ? value.slice(1) : value
  const file = join(root, 'public', relative)
  return existsSync(file) ? file : null
}

function contentType(file) {
  const ext = extname(file).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

function requiredEnv() {
  const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ]
  const missing = keys.filter((key) => !process.env[key])
  if (missing.length) throw new Error(`FIREBASE_CONFIG_MISSING:\n${missing.join('\n')}`)
}

async function main() {
  requiredEnv()
  const source = readSqlite()
  const images = source.products.map((product) => ({
    id: product.id,
    file: localImagePath(product.image, product.id),
    current: product.image,
  }))
  const foundImages = images.filter((item) => item.file)
  const missingImages = images.filter((item) => !item.file && !String(item.current || '').startsWith('http'))

  console.log('SQLite source')
  console.log(`Categories found: ${source.categories.length}`)
  console.log(`Products found: ${source.products.length}`)
  console.log(`Images found: ${foundImages.length}`)
  console.log(`Orders found: ${source.orders.length}`)
  console.log(`Customers found: ${source.customers.length}`)
  if (dryRun) {
    console.log('')
    console.log('Would create:')
    console.log(`${source.categories.length} categories`)
    console.log(`${source.products.length} products`)
    console.log(`${foundImages.length} storage uploads`)
    console.log(`${source.orders.length} orders`)
    if (missingImages.length) {
      console.log('Missing local image files:')
      for (const item of missingImages) console.log(`- ${item.id} ${item.current || '(none)'}`)
    }
    console.log('NO WRITES.')
    if (source.categories.length !== 6 || source.products.length !== 85) {
      process.exitCode = 1
    }
    return
  }

  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  })
  const auth = getAuth(app)
  const firestore = getFirestore(app)
  const storage = getStorage(app)
  const email = process.env.FIREBASE_ADMIN_EMAIL
  const password = process.env.FIREBASE_ADMIN_PASSWORD
  if (!email || !password) throw new Error('FIREBASE_ADMIN_EMAIL / FIREBASE_ADMIN_PASSWORD missing')

  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch {
    await createUserWithEmailAndPassword(auth, email, password)
  }
  const uid = auth.currentUser.uid
  await setDoc(doc(firestore, 'users', uid), { role: 'ADMIN', email, createdAt: new Date().toISOString() })

  for (const category of source.categories) {
    await setDoc(doc(firestore, 'categories', category.id), {
      id: category.id,
      name: category.name,
      blurb: category.blurb,
      sort: Number(category.sort) || 0,
      active: true,
    })
    console.log(`category ${category.id}`)
  }

  let uploaded = 0
  let broken = []
  for (const product of source.products) {
    let image = product.image || `/products/${product.id}.png`
    const file = localImagePath(image, product.id)
    if (file) {
      try {
        const bytes = readFileSync(file)
        const stored = ref(storage, `products/${product.id}/${product.id}${extname(file)}`)
        await uploadBytes(stored, bytes, { contentType: contentType(file) })
        image = await getDownloadURL(stored)
        uploaded += 1
      } catch (error) {
        broken.push(`${product.id}: ${error instanceof Error ? error.message : error}`)
      }
    } else if (!String(image).startsWith('http')) {
      broken.push(`${product.id}: missing local file ${image}`)
    }
    await setDoc(doc(firestore, 'products', product.id), {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      compareAt: product.compare_at ?? null,
      description: product.description,
      specs: parseJson(product.specs, []),
      stock: product.stock,
      badge: product.badge || null,
      rating: product.rating,
      reviews: product.reviews,
      tone: product.tone,
      image,
      images: image ? [image] : [],
      active: product.active === 1 || product.active === true,
      sizes: parseJson(product.sizes, []),
      colors: parseJson(product.colors, []),
      choices: parseJson(product.choices, { size: false, color: false, other: false, otherLabel: 'אחר', others: [] }),
      variants: parseJson(product.variants, []),
      updatedAt: new Date().toISOString(),
    })
    console.log(`product ${product.id}`)
  }

  if (source.settings?.data) {
    await setDoc(doc(firestore, 'settings', 'store'), parseJson(source.settings.data, {}), { merge: true })
  }
  const lastOrder = source.orders
    .map((order) => Number(String(order.id).replace('MED-', '')))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 10040)
  await setDoc(doc(firestore, 'settings', 'counters'), { lastOrder }, { merge: true })
  await setDoc(doc(firestore, 'settings', 'bootstrap'), { done: true, at: new Date().toISOString() })

  for (const order of source.orders) {
    await setDoc(doc(firestore, 'orders', order.id), {
      id: order.id,
      createdAt: order.created_at,
      status: order.status,
      customer: parseJson(order.customer_json, {}),
      items: parseJson(order.items_json, []),
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      total: order.total,
      coupon: order.coupon || null,
    })
  }
  for (const customer of source.customers) {
    await setDoc(doc(firestore, 'customers', customer.id), {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      birthday: customer.birthday || '',
      city: customer.city || '',
      address: customer.address || '',
      points: Number(customer.points) || 0,
      nextPercent: Number(customer.next_percent) || 0,
      couponCode: customer.coupon_code || '',
      couponPercent: Number(customer.coupon_percent) || 0,
    })
  }
  for (const service of source.services) {
    await setDoc(doc(firestore, 'services', service.id), {
      id: service.id,
      name: service.name,
      days: parseJson(service.days, []),
      openTime: service.open_time,
      closeTime: service.close_time,
      slotMinutes: service.slot_minutes,
      therapist: service.therapist || '',
      active: service.active === 1 || service.active === true,
    })
  }
  for (const item of source.appointments) {
    await setDoc(doc(firestore, 'appointments', item.id), {
      id: item.id,
      serviceId: item.service_id,
      customerId: item.customer_id,
      customerName: item.customer_name,
      date: item.date,
      time: item.time,
      status: item.status,
      therapist: item.therapist || '',
      createdAt: item.created_at,
    })
  }
  for (const item of source.employees) {
    await setDoc(doc(firestore, 'employees', item.id), {
      id: item.id,
      name: item.name,
      username: item.username,
      active: item.active === 1 || item.active === true,
    })
  }
  for (const item of source.attendance) {
    await setDoc(doc(firestore, 'attendance', item.id), {
      id: item.id,
      employeeId: item.employee_id,
      employeeName: item.employee_name,
      kind: item.kind,
      at: item.at,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
    })
  }
  for (const item of source.corrections) {
    await setDoc(doc(firestore, 'corrections', item.id), {
      id: item.id,
      employeeId: item.employee_id,
      employeeName: item.employee_name,
      date: item.date,
      kind: item.kind,
      requestedAt: item.requested_at,
      note: item.note || '',
      status: item.status,
      createdAt: item.created_at,
    })
  }
  for (const item of source.mail) {
    await setDoc(doc(firestore, 'mailLog', item.id), {
      id: item.id,
      orderId: item.order_id,
      to: item.to_email,
      status: item.status,
      detail: item.detail,
      createdAt: item.created_at,
    })
  }

  const destCategories = (await getDocs(collection(firestore, 'categories'))).size
  const destProducts = (await getDocs(collection(firestore, 'products'))).size
  console.log('')
  console.log(`Firestore categories: ${destCategories}`)
  console.log(`Firestore products: ${destProducts}`)
  console.log(`Uploaded images: ${uploaded}`)
  if (broken.length) {
    console.log('Broken images:')
    for (const item of broken) console.log(`- ${item}`)
  }
  if (destCategories !== 6 || destProducts !== 85) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
