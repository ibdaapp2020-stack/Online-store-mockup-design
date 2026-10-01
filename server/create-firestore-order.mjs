import { doc, getDoc, getFirestore, runTransaction } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'

function app() {
  const existing = getApps().find((item) => item.name === 'propharm-orders')
  if (existing) return existing
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
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

async function signInPrivileged() {
  const auth = getAuth(app())
  if (auth.currentUser) return auth.currentUser
  const email = process.env.FIREBASE_ADMIN_EMAIL || process.env.PROPHARM_ADMIN_EMAIL || ''
  const password = process.env.FIREBASE_ADMIN_PASSWORD || ''
  if (!email || !password) {
    console.error('ORDER_ERROR_CODE=MISSING_SERVER_AUTH')
    throw Object.assign(new Error('לא הצלחנו לשמור את ההזמנה. לא בוצע חיוב.'), {
      httpStatus: 503,
      code: 'MISSING_SERVER_AUTH',
    })
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (reason) {
    console.error('ORDER_ERROR_CODE=SERVER_AUTH_FAILED')
    throw Object.assign(new Error('שירות ההזמנות אינו זמין כרגע. נסו שוב בעוד מספר רגעים.'), {
      httpStatus: 503,
      code: 'SERVER_AUTH_FAILED',
    })
  }
}

function customerKey(customer) {
  const existing = String(customer?.customerId || '').trim()
  if (existing) return existing
  const email = String(customer?.email || '').trim().toLowerCase()
  const phone = String(customer?.phone || '').replace(/\D/g, '')
  if (email) return `mail-${email}`
  if (phone) return `tel-${phone}`
  return ''
}

export async function createFirestoreOrder({ customer, items, coupon }) {
  await signInPrivileged()
  const name = String(customer?.name || '').trim()
  const phone = String(customer?.phone || '').trim()
  const city = String(customer?.city || '').trim()
  const address = String(customer?.address || '').trim()
  const email = String(customer?.email || '').trim()
  const lines = Array.isArray(items) ? items : []
  if (!name || !phone || !city || !address || !lines.length) {
    throw Object.assign(new Error('חסרים פרטי הזמנה'), { httpStatus: 400 })
  }
  const customerId = customerKey({ email, phone, customerId: customer?.customerId })
  const firestore = db()
  const settingsSnap = await getDoc(doc(firestore, 'settings', 'store'))
  const settings = settingsSnap.data() || {}
  const couponCode = String(settings.couponCode || 'DEMO10')
  const couponOn = Boolean(coupon && String(coupon).trim().toUpperCase() === couponCode.toUpperCase())
  const shippingFee = Number(settings.shippingFee ?? 29)
  const freeFrom = Number(settings.freeFrom ?? 199)
  const couponPercent = Number(settings.couponPercent ?? 10)

  const order = await runTransaction(firestore, async (tx) => {
    const counterRef = doc(firestore, 'settings', 'counters')
    const counterSnap = await tx.get(counterRef)
    const last = Number(counterSnap.data()?.lastOrder) || 10040
    const orderId = `MED-${last + 1}`
    const built = []
    for (const line of lines) {
      const productRef = doc(firestore, 'products', String(line.productId))
      const snap = await tx.get(productRef)
      if (!snap.exists()) throw Object.assign(new Error('מוצר לא זמין'), { httpStatus: 400 })
      const product = snap.data()
      const qty = Number(line.qty)
      const stock = Number(product.stock) || 0
      if (product.active === false || !Number.isInteger(qty) || qty < 1) {
        throw Object.assign(new Error('מוצר לא זמין'), { httpStatus: 400 })
      }
      if (stock < qty) throw Object.assign(new Error(`אין מספיק מלאי עבור ${product.name}`), { httpStatus: 400 })
      tx.update(productRef, { stock: stock - qty, updatedAt: new Date().toISOString() })
      const item = {
        productId: snap.id,
        name: product.name,
        price: Number(product.price) || 0,
        qty,
      }
      if (line.size) item.size = line.size
      if (line.color) item.color = line.color
      if (line.other) item.other = line.other
      built.push(item)
    }
    const subtotal = built.reduce((sum, item) => sum + item.price * item.qty, 0)
    const discount = couponOn ? Math.round(subtotal * (couponPercent / 100)) : 0
    const shipping = subtotal - discount >= freeFrom ? 0 : shippingFee
    const created = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'received',
      customer: { customerId, name, phone, email, city, address },
      items: built,
      subtotal,
      discount,
      shipping,
      total: subtotal - discount + shipping,
    }
    if (couponOn) created.coupon = couponCode
    tx.set(doc(firestore, 'orders', orderId), created)
    tx.set(counterRef, { lastOrder: last + 1 }, { merge: true })
    return created
  })
  return order
}
