import { collection, doc, getDoc, getDocs, getFirestore, query, where, writeBatch } from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'

function app() {
  const existing = getApps().find((item) => item.name === 'propharm-orders')
  if (existing) return existing
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || ''
  if (!projectId) throw Object.assign(new Error('VITE_FIREBASE_PROJECT_ID missing'), { httpStatus: 502 })
  return initializeApp(
    {
      apiKey: process.env.VITE_FIREBASE_API_KEY || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.VITE_FIREBASE_APP_ID || '',
    },
    'propharm-orders',
  )
}

function db() {
  return getFirestore(app())
}

export async function createFirestoreOrder({ customer, items, coupon }) {
  const name = String(customer?.name || '').trim()
  const phone = String(customer?.phone || '').trim()
  const city = String(customer?.city || '').trim()
  const address = String(customer?.address || '').trim()
  const lines = Array.isArray(items) ? items : []
  if (!name || !phone || !city || !address || !lines.length) {
    throw Object.assign(new Error('חסרים פרטי הזמנה'), { httpStatus: 400 })
  }
  const settingsSnap = await getDoc(doc(db(), 'settings', 'store'))
  const settings = settingsSnap.data() || {}
  const couponCode = String(settings.couponCode || 'DEMO10')
  const couponOn = Boolean(coupon && String(coupon).trim().toUpperCase() === couponCode.toUpperCase())
  const counterRef = doc(db(), 'settings', 'counters')
  const counterSnap = await getDoc(counterRef)
  const last = Number(counterSnap.data()?.lastOrder) || 10040
  const orderId = `MED-${last + 1}`
  const built = []
  const batch = writeBatch(db())
  for (const line of lines) {
    const productRef = doc(db(), 'products', String(line.productId))
    const snap = await getDoc(productRef)
    if (!snap.exists()) throw Object.assign(new Error('מוצר לא זמין'), { httpStatus: 400 })
    const product = snap.data()
    const qty = Number(line.qty)
    const stock = Number(product.stock) || 0
    if (product.active === false || !Number.isInteger(qty) || qty < 1) throw Object.assign(new Error('מוצר לא זמין'), { httpStatus: 400 })
    if (stock < qty) throw Object.assign(new Error(`אין מספיק מלאי עבור ${product.name}`), { httpStatus: 400 })
    batch.update(productRef, { stock: stock - qty, updatedAt: new Date().toISOString() })
    built.push({ productId: snap.id, name: product.name, price: Number(product.price) || 0, qty, size: line.size, color: line.color })
  }
  const subtotal = built.reduce((sum, item) => sum + item.price * item.qty, 0)
  const shippingFee = Number(settings.shippingFee ?? 29)
  const freeFrom = Number(settings.freeFrom ?? 199)
  const couponPercent = Number(settings.couponPercent ?? 10)
  const discount = couponOn ? Math.round(subtotal * (couponPercent / 100)) : 0
  const shipping = subtotal - discount >= freeFrom ? 0 : shippingFee
  const order = {
    id: orderId,
    createdAt: new Date().toISOString(),
    status: 'received',
    customer: { name, phone, email: String(customer?.email || '').trim(), city, address },
    items: built,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    coupon: couponOn ? couponCode : undefined,
  }
  batch.set(doc(db(), 'orders', orderId), order)
  batch.set(counterRef, { lastOrder: last + 1 }, { merge: true })
  await batch.commit()
  return order
}

export async function listActiveProducts() {
  const snap = await getDocs(query(collection(db(), 'products'), where('active', '==', true)))
  return snap.size
}
