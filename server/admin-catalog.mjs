import { collection, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getApps, initializeApp } from 'firebase/app'
import { loadPublicCatalog } from './catalog-public.mjs'

const PORTAL_ORIGINS = ['https://portal.propharm.dev', 'https://propharm.dev']

function firebaseConfig() {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || '',
  }
}

function adminApp() {
  const existing = getApps().find((item) => item.name === 'propharm-admin-api')
  if (existing) return existing
  const config = firebaseConfig()
  if (!config.projectId) throw Object.assign(new Error('חסר חיבור ל-Firebase'), { httpStatus: 502 })
  return initializeApp(config, 'propharm-admin-api')
}

function db() {
  return getFirestore(adminApp())
}

function allowedAdminEmails() {
  return [process.env.PROPHARM_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_EMAIL, 'propharm2026@gmail.com']
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
}

async function lookupToken(idToken) {
  const key = process.env.VITE_FIREBASE_API_KEY || ''
  if (!idToken || !key) return null
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const payload = await response.json().catch(() => ({}))
  return payload.users?.[0] || null
}

async function signInPrivileged() {
  const auth = getAuth(adminApp())
  if (auth.currentUser) return auth.currentUser
  const email = process.env.FIREBASE_ADMIN_EMAIL || process.env.PROPHARM_ADMIN_EMAIL || ''
  const password = process.env.FIREBASE_ADMIN_PASSWORD || ''
  if (!email || !password) return null
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

function productFrom(id, data) {
  return {
    id,
    name: String(data.name || ''),
    category: String(data.categoryId || data.category || ''),
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

export function applyAdminCors(req, res) {
  const origin = String(req.headers.origin || '')
  if (PORTAL_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Vary', 'Origin')
  }
}

export async function requirePortalAdmin(req) {
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const user = await lookupToken(token)
  if (!user?.email) {
    throw Object.assign(new Error('נדרשת כניסת ניהול'), { httpStatus: 401 })
  }
  const email = String(user.email).toLowerCase()
  if (allowedAdminEmails().includes(email)) return user
  try {
    await signInPrivileged()
    const snap = await getDoc(doc(db(), 'users', user.localId))
    if (snap.data()?.role === 'ADMIN') return user
  } catch {
    /* fall through */
  }
  throw Object.assign(new Error('אין הרשאת מנהל'), { httpStatus: 403 })
}

export async function listAdminProducts() {
  try {
    if (await signInPrivileged()) {
      const snap = await getDocs(collection(db(), 'products'))
      return snap.docs.map((item) => productFrom(item.id, item.data()))
    }
  } catch (error) {
    console.error('ADMIN_PRODUCTS_PRIVILEGED', error instanceof Error ? error.message : error)
  }
  try {
    const snap = await getDocs(query(collection(db(), 'products'), where('active', '==', true)))
    return snap.docs.map((item) => productFrom(item.id, item.data()))
  } catch (error) {
    console.error('ADMIN_PRODUCTS_ACTIVE', error instanceof Error ? error.message : error)
    const catalog = await loadPublicCatalog()
    return catalog.products
  }
}

export async function getAdminProduct(id) {
  const rows = await listAdminProducts()
  const found = rows.find((item) => item.id === id)
  if (found) return found
  try {
    const snap = await getDoc(doc(db(), 'products', id))
    if (snap.exists()) return productFrom(snap.id, snap.data())
  } catch {
    /* ignore */
  }
  throw Object.assign(new Error('המוצר לא נמצא'), { httpStatus: 404 })
}

export async function saveAdminProduct(product) {
  if (!(await signInPrivileged())) {
    throw Object.assign(new Error('לא ניתן לשמור מוצר בשרת כרגע'), { httpStatus: 503 })
  }
  const payload = {
    ...product,
    compareAt: product.compareAt ?? null,
    badge: product.badge ?? null,
    images: product.image ? [product.image] : [],
    categoryId: product.category,
    updatedAt: new Date().toISOString(),
  }
  await setDoc(doc(db(), 'products', product.id), payload, { merge: true })
  return getAdminProduct(product.id)
}

export async function listAdminCategories() {
  try {
    const snap = await getDocs(collection(db(), 'categories'))
    return snap.docs.map((item) => categoryFrom(item.id, item.data())).sort((a, b) => a.sort - b.sort)
  } catch (error) {
    console.error('ADMIN_CATEGORIES', error instanceof Error ? error.message : error)
    const catalog = await loadPublicCatalog()
    return catalog.categories
  }
}

export function registerAdminCatalog(app) {
  async function withAdmin(req, res, next) {
    try {
      req.portalAdmin = await requirePortalAdmin(req)
      next()
    } catch (error) {
      const status = Number(error?.httpStatus) || 401
      res.status(status).json({ error: error instanceof Error ? error.message : 'נדרשת כניסת ניהול' })
    }
  }

  async function send(res, run) {
    try {
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      res.json(await run())
    } catch (error) {
      const status = Number(error?.httpStatus) || 502
      res.status(status).json({ error: error instanceof Error ? error.message : 'חיבור לא תקין' })
    }
  }

  const products = (_req, res) => send(res, listAdminProducts)
  const categories = (_req, res) => send(res, listAdminCategories)
  const oneProduct = (req, res) => send(res, () => getAdminProduct(req.params.id))

  app.get('/', withAdmin, products)
  app.get('/products', withAdmin, products)
  app.get('/api/admin/products', withAdmin, products)
  app.get('/products/:id', withAdmin, oneProduct)
  app.get('/api/admin/products/:id', withAdmin, oneProduct)
  app.get('/categories', withAdmin, categories)
  app.get('/api/admin/categories', withAdmin, categories)
}
