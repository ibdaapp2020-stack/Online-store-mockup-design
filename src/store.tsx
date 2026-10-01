import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { quote, type Quote } from './pricing'
import type { CartLine, Category, Customer, Order, Product, ShopSettings } from './types'
import { optionStock } from './types'
import { applyLiveCatalog } from './catalog-sync'
import { firebaseEnvError } from './lib/firebase/config'
import { categoryFrom, db, getSettings, listCategories, listProducts, productFrom, settingsFrom } from './lib/data/core'
import { accountFetch } from './lib/data/http'
import { findStoreOrder, placeStoreOrder } from './lib/data/orders'
import { notifyOrderCreated } from './lib/notify'


const CART_KEY = 'medica-cart'

export function cartKey(productId: string, size?: string, color?: string, other?: string) {
  return `${productId}::${size ?? ''}::${color ?? ''}::${other ?? ''}`
}
const COUPON_KEY = 'medica-coupon'
const RECENT_KEY = 'medica-recent-orders'

const FALLBACK_SETTINGS: ShopSettings = {
  storeName: 'PRO PHARM',
  tagline: 'ORTHO & MOBILITY',
  banner: '',
  showBanner: false,
  disclaimer: 'האתר אינו בית מרקחת ואינו מחליף ייעוץ רפואי.',
  shippingFee: 29,
  freeFrom: 199,
  couponCode: 'DEMO10',
  couponPercent: 10,
  paymentNote: 'ההזמנה נשמרת בחנות. פרטי הכרטיס לא נשמרים.',
  loyaltyMode: 'points',
  pointsPer100: 10,
  clubPercent: 5,
  notifyEmail: 'propharm2026@gmail.com',
  smtpUser: 'propharm2026@gmail.com',
}

export type CartDetail = CartLine & { product: Product }

type StoreValue = {
  ready: boolean
  error: string
  products: Product[]
  categories: Category[]
  settings: ShopSettings
  cart: CartDetail[]
  recentOrders: Order[]
  coupon: string | null
  toast: string
  totals: Quote
  cartCount: number
  refreshCatalog: () => Promise<void>
  addToCart: (productId: string, qty?: number, options?: { size?: string; color?: string; other?: string }) => void
  setQty: (key: string, qty: number) => void
  removeFromCart: (key: string) => void
  applyCoupon: (code: string) => Promise<boolean>
  clearCoupon: () => void
  placeOrder: (customer: Customer) => Promise<string | null>
  findOrder: (id: string) => Promise<Order | null>
}

const StoreContext = createContext<StoreValue | null>(null)

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<ShopSettings>(FALLBACK_SETTINGS)
  const [cart, setCart] = useState<CartLine[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>(() => readJson<Order[]>(RECENT_KEY) ?? [])
  const [coupon, setCoupon] = useState<string | null>(null)
  const [extraPercent, setExtraPercent] = useState(0)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  function applyCatalog(nextProducts: Product[], nextCategories: Category[], nextSettings: ShopSettings) {
    const live = applyLiveCatalog(nextProducts, nextCategories, nextSettings)
    setProducts(live.products)
    setCategories(live.categories)
    setSettings(live.settings)
    setCart((current) => {
      const stored = current.length ? current : readJson<CartLine[]>(CART_KEY) ?? []
      return stored.filter((line) => live.products.some((product) => product.id === line.productId && product.stock > 0))
    })
    const savedCoupon = localStorage.getItem(COUPON_KEY)
    const savedPercent = Number(localStorage.getItem('medica-coupon-percent') || 0)
    if (savedCoupon && (savedCoupon.toUpperCase() === live.settings.couponCode.toUpperCase() || savedPercent > 0)) {
      setCoupon(savedCoupon)
      setExtraPercent(savedCoupon.toUpperCase() === live.settings.couponCode.toUpperCase() ? 0 : savedPercent)
    }
  }

  async function refreshCatalogFromApi() {
    const response = await fetch('/api/catalog')
    if (!response.ok) throw new Error('לא ניתן לטעון את החנות')
    const data = (await response.json()) as { products: Product[]; categories: Category[]; settings: ShopSettings }
    applyCatalog(data.products, data.categories, data.settings)
    setReady(true)
  }

  async function refreshCatalog() {
    const missing = firebaseEnvError()
    if (missing) throw new Error(`FIREBASE_CONFIG_MISSING:\n${missing.missing.join('\n')}`)
    try {
      const [nextProducts, nextCategories, nextSettings] = await Promise.all([listProducts(true), listCategories(), getSettings()])
      if (nextProducts.length) {
        applyCatalog(nextProducts, nextCategories, nextSettings)
        return
      }
    } catch {
      /* Firestore empty or denied — use SQLite API until migration lands */
    }
    await refreshCatalogFromApi()
  }

  useEffect(() => {
    const missing = firebaseEnvError()
    if (missing) {
      setError(`FIREBASE_CONFIG_MISSING:\n${missing.missing.join('\n')}`)
      setReady(true)
      return
    }
    const unsubProducts = onSnapshot(collection(db(), 'products'), (snap) => {
      const rows = snap.docs.map((item) => productFrom(item.id, item.data())).filter((product) => product.active !== false)
      if (!rows.length) {
        void refreshCatalogFromApi().catch((reason) => {
          setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את החנות')
          setReady(true)
        })
        return
      }
      setProducts(rows)
      setCart((current) => {
        const stored = current.length ? current : readJson<CartLine[]>(CART_KEY) ?? []
        return stored.filter((line) => rows.some((product) => product.id === line.productId && product.stock > 0))
      })
      setReady(true)
      setError('')
    }, () => {
      void refreshCatalogFromApi().catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את החנות')
        setReady(true)
      })
    })
    const unsubCategories = onSnapshot(collection(db(), 'categories'), (snap) => {
      setCategories(snap.docs.map((item) => categoryFrom(item.id, item.data())).sort((a, b) => a.sort - b.sort))
    })
    const unsubSettings = onSnapshot(doc(db(), 'settings', 'store'), (snap) => {
      setSettings(settingsFrom(snap.data()))
    })
    return () => {
      unsubProducts()
      unsubCategories()
      unsubSettings()
    }
  }, [])

  useEffect(() => {
    function onCatalog() {
      void refreshCatalog()
    }
    window.addEventListener('medica-catalog', onCatalog)
    window.addEventListener('storage', onCatalog)
    return () => {
      window.removeEventListener('medica-catalog', onCatalog)
      window.removeEventListener('storage', onCatalog)
    }
  }, [])

  useEffect(() => {
    if (ready) localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart, ready])

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentOrders))
  }, [recentOrders])

  useEffect(() => {
    if (coupon) localStorage.setItem(COUPON_KEY, coupon)
    else localStorage.removeItem(COUPON_KEY)
    if (extraPercent > 0) localStorage.setItem('medica-coupon-percent', String(extraPercent))
    else localStorage.removeItem('medica-coupon-percent')
  }, [coupon, extraPercent])

  function notify(message: string) {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  const detailed = useMemo<CartDetail[]>(
    () =>
      cart.flatMap((line) => {
        const product = products.find((item) => item.id === line.productId)
        return product ? [{ ...line, product }] : []
      }),
    [cart, products],
  )

  const totals = useMemo(() => {
    const personal = Boolean(coupon) && extraPercent > 0 && coupon?.toUpperCase() !== settings.couponCode.toUpperCase()
    return quote(
      detailed.reduce((sum, line) => sum + line.product.price * line.qty, 0),
      Boolean(coupon) && (coupon?.toUpperCase() === settings.couponCode.toUpperCase() || personal),
      personal ? { ...settings, couponPercent: extraPercent } : settings,
    )
  }, [detailed, coupon, settings, extraPercent])

  const cartCount = detailed.reduce((sum, line) => sum + line.qty, 0)

  function addToCart(productId: string, qty = 1, options?: { size?: string; color?: string; other?: string }) {
    const product = products.find((item) => item.id === productId)
    const size = options?.size || undefined
    const color = options?.color || undefined
    const other = options?.other || undefined
    const available = product ? optionStock(product, { size, color, other }) : 0
    if (!product || available <= 0 || qty <= 0) return
    const key = cartKey(productId, size, color, other)
    setCart((prev) => {
      const existing = prev.find((line) => cartKey(line.productId, line.size, line.color, line.other) === key)
      const nextQty = Math.min(available, (existing?.qty ?? 0) + qty)
      if (existing) return prev.map((line) => (cartKey(line.productId, line.size, line.color, line.other) === key ? { ...line, qty: nextQty } : line))
      return [...prev, { productId, qty: nextQty, size, color, other }]
    })
    notify('נוסף לסל')
  }

  function setQty(key: string, qty: number) {
    const current = cart.find((line) => cartKey(line.productId, line.size, line.color, line.other) === key)
    const product = products.find((item) => item.id === current?.productId)
    if (!current || !product) return
    if (qty <= 0) {
      setCart((prev) => prev.filter((line) => cartKey(line.productId, line.size, line.color, line.other) !== key))
      return
    }
    const nextQty = Math.min(optionStock(product, current), qty)
    setCart((prev) => prev.map((line) => (cartKey(line.productId, line.size, line.color, line.other) === key ? { ...line, qty: nextQty } : line)))
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((line) => cartKey(line.productId, line.size, line.color, line.other) !== key))
  }

  async function applyCoupon(code: string) {
    const normalized = code.trim().toUpperCase()
    if (normalized === settings.couponCode.toUpperCase()) {
      setCoupon(settings.couponCode)
      setExtraPercent(0)
      notify(`קופון ${settings.couponCode} הופעל`)
      return true
    }
    try {
      const data = await accountFetch<{ code: string; percent: number }>('/api/account/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalized }),
      })
      setCoupon(data.code)
      setExtraPercent(data.percent)
      notify(`קופון ${data.code} הופעל`)
      return true
    } catch {
      notify('הקוד לא מוכר, או שהוא שייך לחשבון אחר. צריך להיות מחוברים כלקוח.')
      return false
    }
  }

  function clearCoupon() {
    setCoupon(null)
    setExtraPercent(0)
  }

  async function placeOrder(customer: Customer) {
    if (detailed.length === 0) return null
    try {
      const data = await placeStoreOrder(
        customer,
        detailed.map((line) => ({ productId: line.productId, qty: line.qty, size: line.size, color: line.color, other: line.other })),
        coupon,
      )
      setRecentOrders((prev) => [data.order, ...prev.filter((order) => order.id !== data.order.id)])
      setCart([])
      setCoupon(null)
      setExtraPercent(0)
      void notifyOrderCreated(data.order, data.stockAfter, customer.language || 'he')
      return data.order.id
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'לא ניתן לקלוט את ההזמנה')
      return null
    }
  }

  async function findOrder(id: string) {
    const local = recentOrders.find((order) => order.id.toLowerCase() === id.toLowerCase())
    return (await findStoreOrder(id)) ?? local ?? null
  }

  const value: StoreValue = {
    ready,
    error,
    products,
    categories,
    settings,
    cart: detailed,
    recentOrders,
    coupon,
    toast,
    totals,
    cartCount,
    refreshCatalog,
    addToCart,
    setQty,
    removeFromCart,
    applyCoupon,
    clearCoupon,
    placeOrder,
    findOrder,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore מחוץ לספק')
  return value
}
