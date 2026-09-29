import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { quote, type Quote } from './pricing'
import type { CartLine, Category, Customer, Order, Product, ShopSettings } from './types'

const CART_KEY = 'medica-cart'
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
  addToCart: (productId: string, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  removeFromCart: (productId: string) => void
  applyCoupon: (code: string) => boolean
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
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  async function refreshCatalog() {
    const response = await fetch('/api/catalog')
    if (!response.ok) throw new Error('לא ניתן לטעון את החנות')
    const data = (await response.json()) as { products: Product[]; categories: Category[]; settings: ShopSettings }
    setProducts(data.products)
    setCategories(data.categories)
    setSettings(data.settings)
    setCart((current) => {
      const stored = current.length ? current : readJson<CartLine[]>(CART_KEY) ?? []
      return stored.filter((line) => data.products.some((product) => product.id === line.productId && product.stock > 0))
    })
    const savedCoupon = localStorage.getItem(COUPON_KEY)
    if (savedCoupon && savedCoupon.toUpperCase() === data.settings.couponCode.toUpperCase()) setCoupon(data.settings.couponCode)
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
    if (ready) localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart, ready])

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentOrders))
  }, [recentOrders])

  useEffect(() => {
    if (coupon) localStorage.setItem(COUPON_KEY, coupon)
    else localStorage.removeItem(COUPON_KEY)
  }, [coupon])

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

  const totals = useMemo(
    () =>
      quote(
        detailed.reduce((sum, line) => sum + line.product.price * line.qty, 0),
        coupon?.toUpperCase() === settings.couponCode.toUpperCase(),
        settings,
      ),
    [detailed, coupon, settings],
  )

  const cartCount = detailed.reduce((sum, line) => sum + line.qty, 0)

  function addToCart(productId: string, qty = 1) {
    const product = products.find((item) => item.id === productId)
    if (!product || product.stock <= 0 || qty <= 0) return
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === productId)
      const nextQty = Math.min(product.stock, (existing?.qty ?? 0) + qty)
      if (existing) return prev.map((line) => (line.productId === productId ? { ...line, qty: nextQty } : line))
      return [...prev, { productId, qty: nextQty }]
    })
    notify('נוסף לסל')
  }

  function setQty(productId: string, qty: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    if (qty <= 0) {
      setCart((prev) => prev.filter((line) => line.productId !== productId))
      return
    }
    const nextQty = Math.min(product.stock, qty)
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, qty: nextQty } : line)))
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId))
  }

  function applyCoupon(code: string) {
    if (code.trim().toUpperCase() === settings.couponCode.toUpperCase()) {
      setCoupon(settings.couponCode)
      notify(`קופון ${settings.couponCode} הופעל`)
      return true
    }
    notify(`הקוד לא מוכר. הקוד הפעיל: ${settings.couponCode}`)
    return false
  }

  function clearCoupon() {
    setCoupon(null)
  }

  async function placeOrder(customer: Customer) {
    if (detailed.length === 0) return null
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer,
        coupon,
        items: detailed.map((line) => ({ productId: line.productId, qty: line.qty })),
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
