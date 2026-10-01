import { initializeApp, getApps } from 'firebase/app'
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore'

function catalogApp() {
  const existing = getApps().find((app) => app.name === 'propharm-catalog')
  if (existing) return existing
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || ''
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID missing')
  return initializeApp(
    {
      apiKey: process.env.VITE_FIREBASE_API_KEY || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.VITE_FIREBASE_APP_ID || '',
    },
    'propharm-catalog',
  )
}

function catalogDb() {
  return getFirestore(catalogApp())
}

function productFrom(id, data) {
  return {
    id,
    name: String(data.name || ''),
    category: String(data.category || ''),
    price: Number(data.price) || 0,
    compareAt: data.compareAt == null ? undefined : Number(data.compareAt),
    description: String(data.description || ''),
    specs: Array.isArray(data.specs) ? data.specs.map(String) : [],
    stock: Number(data.stock) || 0,
    badge: data.badge || undefined,
    rating: Number(data.rating) || 0,
    reviews: Number(data.reviews) || 0,
    tone: String(data.tone || '#0f766e'),
    image: data.image || undefined,
    active: data.active !== false,
    sizes: Array.isArray(data.sizes) ? data.sizes.map(String) : [],
    colors: Array.isArray(data.colors) ? data.colors.map(String) : [],
    choices: data.choices || { size: false, color: false, other: false, otherLabel: 'אחר', others: [] },
    variants: Array.isArray(data.variants) ? data.variants : [],
  }
}

function categoryFrom(id, data) {
  return {
    id,
    name: String(data.name || id),
    blurb: String(data.blurb || ''),
    sort: Number(data.sort) || 0,
    image: data.image || undefined,
    active: data.active !== false,
  }
}

export async function loadPublicCatalog() {
  const db = catalogDb()
  let productSnap
  try {
    productSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)))
  } catch {
    productSnap = await getDocs(collection(db, 'products'))
  }
  let products = productSnap.docs.map((item) => productFrom(item.id, item.data())).filter((item) => item.active !== false)
  if (!products.length) {
    const all = await getDocs(collection(db, 'products'))
    products = all.docs.map((item) => productFrom(item.id, item.data())).filter((item) => item.active !== false)
  }
  const categorySnap = await getDocs(collection(db, 'categories'))
  const categories = categorySnap.docs
    .map((item) => categoryFrom(item.id, item.data()))
    .filter((item) => item.active !== false)
    .sort((a, b) => a.sort - b.sort)
  const settingsSnap = await getDoc(doc(db, 'settings', 'store'))
  const settings = settingsSnap.data() || {}
  return {
    products,
    categories,
    settings: {
      storeName: String(settings.storeName || 'PRO PHARM'),
      tagline: String(settings.tagline || ''),
      banner: String(settings.banner || ''),
      showBanner: Boolean(settings.showBanner),
      disclaimer: String(settings.disclaimer || ''),
      shippingFee: Number(settings.shippingFee ?? 29),
      freeFrom: Number(settings.freeFrom ?? 199),
      couponCode: String(settings.couponCode || 'DEMO10'),
      couponPercent: Number(settings.couponPercent ?? 10),
      paymentNote: String(settings.paymentNote || ''),
      loyaltyMode: settings.loyaltyMode === 'percent' ? 'percent' : 'points',
      pointsPer100: Number(settings.pointsPer100 ?? 10),
      clubPercent: Number(settings.clubPercent ?? 5),
      notifyEmail: String(settings.notifyEmail || ''),
    },
  }
}
