import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { quote, type Quote } from './pricing'
import type { CartLine, Category, Customer, Order, Product, ShopSettings } from './types'
import { optionStock } from './types'
import { applyLiveCatalog } from './catalog-sync'


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

  async function refreshCatalog() {
    const response = await fetch('/api/catalog')
    if (!response.ok) throw new Error('לא ניתן לטעון את החנות')
    const data = (await response.json()) as { products: Product[]; categories: Category[]; settings: ShopSettings }
    const live = applyLiveCatalog(data.products, data.categories, data.settings)
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

  useEffect(() => {
    refreshCatalog()
      .then(() => setReady(true))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'שגיאת טעינה')
        setReady(true)
      })
  }, [])

  useEffect(() => {
    function onCatalog() {
      void refreshCatalog()
    }
    window.addEventListener('medica-catalog', onCatalog)
    window.addEventListener('storage', onCatalog)
    window.addEventListener('focus', onCatalog)
    document.addEventListener('visibilitychange', onCatalog)
    return () => {
      window.removeEventListener('medica-catalog', onCatalog)
      window.removeEventListener('storage', onCatalog)
      window.removeEventListener('focus', onCatalog)
      document.removeEventListener('visibilitychange', onCatalog)
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
    const response = await fetch('/api/account/coupon', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normalized }),
    })
    if (response.ok) {
      const data = (await response.json()) as { code: string; percent: number }
      setCoupon(data.code)
      setExtraPercent(data.percent)
      notify(`קופון ${data.code} הופעל`)
      return true
    }
    notify('הקוד לא מוכר, או שהוא שייך לחשבון אחר. צריך להיות מחוברים כלקוח.')
    return false
  }

  function clearCoupon() {
    setCoupon(null)
    setExtraPercent(0)
  }

  async function placeOrder(customer: Customer) {
    if (detailed.length === 0) return null
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        customer,
        coupon,
        items: detailed.map((line) => ({ productId: line.productId, qty: line.qty, size: line.size, color: line.color, other: line.other })),
      }),
    })
    const data = (await response.json()) as Order & { error?: string }
    if (!response.ok) {
      notify(data.error || 'לא ניתן לקלוט את ההזמנה')
      return null
    }
    setRecentOrders((prev) => [data, ...prev.filter((order) => order.id !== data.id)])
    setCart([])
    setCoupon(null)
    setExtraPercent(0)
    await refreshCatalog()
    return data.id
  }

  async function findOrder(id: string) {
    const local = recentOrders.find((order) => order.id.toLowerCase() === id.toLowerCase())
    const response = await fetch(`/api/orders/track/${encodeURIComponent(id)}`)
    if (!response.ok) return local ?? null
    return (await response.json()) as Order
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
