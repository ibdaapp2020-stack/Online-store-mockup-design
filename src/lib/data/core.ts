import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { getFirebaseDb } from '../firebase/config'
import { uploadProductImage } from '../firebase/storage'
import type { Category, Order, Product, ShopSettings } from '../../types'

export function db() {
  return getFirebaseDb()
}

export function clean<T extends DocumentData>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

export function productFrom(id: string, data: DocumentData): Product {
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

export function categoryFrom(id: string, data: DocumentData): Category & { sort: number; image?: string; active?: boolean } {
  return {
    id,
    name: String(data.name || ''),
    blurb: String(data.blurb || ''),
    sort: Number(data.sort) || 0,
    image: data.image || undefined,
    active: data.active !== false,
  }
}

export function settingsFrom(data: DocumentData | undefined): ShopSettings {
  return {
    storeName: String(data?.storeName || 'PRO PHARM'),
    tagline: String(data?.tagline || 'ORTHO & MOBILITY'),
    banner: String(data?.banner || ''),
    showBanner: Boolean(data?.showBanner),
    disclaimer: String(data?.disclaimer || 'האתר אינו בית מרקחת ואינו מחליף ייעוץ רפואי.'),
    shippingFee: Number(data?.shippingFee ?? 29),
    freeFrom: Number(data?.freeFrom ?? 199),
    couponCode: String(data?.couponCode || 'DEMO10'),
    couponPercent: Number(data?.couponPercent ?? 10),
    paymentNote: String(data?.paymentNote || 'ההזמנה נשמרת בחנות. פרטי הכרטיס לא נשמרים.'),
    loyaltyMode: data?.loyaltyMode === 'percent' ? 'percent' : 'points',
    pointsPer100: Number(data?.pointsPer100 ?? 10),
    clubPercent: Number(data?.clubPercent ?? 5),
    notifyEmail: String(data?.notifyEmail || ''),
    smtpUser: String(data?.smtpUser || ''),
    smtpConfigured: Boolean(data?.smtpConfigured),
  }
}

export function orderFrom(id: string, data: DocumentData): Order {
  return {
    id: String(data.id || id),
    createdAt: String(data.createdAt || ''),
    status: data.status,
    customer: data.customer,
    items: Array.isArray(data.items) ? data.items : [],
    subtotal: Number(data.subtotal) || 0,
    discount: Number(data.discount) || 0,
    shipping: Number(data.shipping) || 0,
    total: Number(data.total) || 0,
    coupon: data.coupon || undefined,
  }
}

export async function listProducts(activeOnly = false) {
  const snap = activeOnly
    ? await getDocs(query(collection(db(), 'products'), where('active', '==', true)))
    : await getDocs(collection(db(), 'products'))
  return snap.docs.map((item) => productFrom(item.id, item.data()))
}

export async function listCategories() {
  const snap = await getDocs(collection(db(), 'categories'))
  return snap.docs.map((item) => categoryFrom(item.id, item.data())).sort((a, b) => a.sort - b.sort)
}

export async function getSettings() {
  const snap = await getDoc(doc(db(), 'settings', 'store'))
  return settingsFrom(snap.data())
}

export async function getProduct(id: string) {
  const snap = await getDoc(doc(db(), 'products', id))
  if (!snap.exists()) return null
  return productFrom(snap.id, snap.data())
}

export async function getOrder(id: string) {
  const snap = await getDoc(doc(db(), 'orders', id))
  if (!snap.exists()) return null
  return orderFrom(snap.id, snap.data())
}

export async function saveProduct(product: Product) {
  const payload = clean({
    ...product,
    compareAt: product.compareAt ?? null,
    badge: product.badge ?? null,
    images: product.image ? [product.image] : [],
    updatedAt: new Date().toISOString(),
  })
  await setDoc(doc(db(), 'products', product.id), payload, { merge: true })
  return getProduct(product.id)
}

export async function saveCategory(category: { id: string; name: string; blurb: string; sort: number; image?: string; active?: boolean }) {
  await setDoc(doc(db(), 'categories', category.id), clean({ ...category, updatedAt: new Date().toISOString() }), { merge: true })
}

export async function removeCategory(id: string) {
  const used = (await listProducts()).filter((product) => product.category === id)
  if (used.length) throw new Error(`בקטגוריה הזו יש ${used.length} מוצרים. יש להעביר אותם או לבטל.`)
  await deleteDoc(doc(db(), 'categories', id))
}

export async function removeProduct(id: string) {
  const orders = await getDocs(collection(db(), 'orders'))
  const referenced = orders.docs.some((item) => (item.data().items || []).some((line: { productId?: string }) => line.productId === id))
  if (referenced) {
    await updateDoc(doc(db(), 'products', id), { active: false, updatedAt: new Date().toISOString() })
    return { archived: true }
  }
  await deleteDoc(doc(db(), 'products', id))
  return { archived: false }
}

export async function uploadImage(path: string, file: File) {
  return uploadProductImage(path, file)
}

export async function listOrders() {
  const snap = await getDocs(collection(db(), 'orders'))
  return snap.docs.map((item) => orderFrom(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function nextOrderId() {
  const snap = await getDocs(collection(db(), 'orders'))
  const nums = snap.docs.map((item) => Number(String(item.id).replace('MED-', ''))).filter((value) => Number.isFinite(value))
  const counter = await getDoc(doc(db(), 'settings', 'counters'))
  const stored = Number(counter.data()?.lastOrder) || 0
  const next = Math.max(10040, stored, ...nums, 10040) + 1
  await setDoc(doc(db(), 'settings', 'counters'), { lastOrder: next }, { merge: true })
  return `MED-${next}`
}

export { writeBatch, doc, collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where }
