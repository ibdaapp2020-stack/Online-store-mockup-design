import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getProduct, SEED_ORDERS, STATUS_FLOW } from './data'
import { COUPON_CODE, quote, type Quote } from './pricing'
import type { CartLine, Customer, Order, OrderStatus, Product } from './types'

const KEYS = {
  cart: 'medica-cart',
  orders: 'medica-orders',
  coupon: 'medica-coupon',
}

export type CartDetail = CartLine & { product: Product }

type StoreValue = {
  cart: CartDetail[]
  orders: Order[]
  coupon: string | null
  toast: string
  totals: Quote
  cartCount: number
  addToCart: (productId: string, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  removeFromCart: (productId: string) => void
  applyCoupon: (code: string) => boolean
  clearCoupon: () => void
  placeOrder: (customer: Customer) => string | null
  advanceStatus: (id: string) => void
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

function isStatus(value: string): value is OrderStatus {
  return STATUS_FLOW.includes(value as OrderStatus)
}

function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== 'object') return false
  const order = value as Order
  return (
    typeof order.id === 'string' &&
    typeof order.status === 'string' &&
    isStatus(order.status) &&
    Array.isArray(order.items) &&
    !!order.customer &&
    typeof order.customer.name === 'string'
  )
}

function loadCart(): CartLine[] {
  const parsed = readJson<unknown>(KEYS.cart)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (line): line is CartLine =>
      !!line &&
      typeof line === 'object' &&
      typeof (line as CartLine).productId === 'string' &&
      (line as CartLine).qty > 0 &&
      !!getProduct((line as CartLine).productId),
  )
}

function loadOrders(): Order[] {
  const parsed = readJson<unknown>(KEYS.orders)
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isOrder)) {
    return SEED_ORDERS.map((order) => ({ ...order, items: order.items.map((item) => ({ ...item })) }))
  }
  return parsed
}

function loadCoupon(): string | null {
  try {
    return localStorage.getItem(KEYS.coupon) === COUPON_CODE ? COUPON_CODE : null
  } catch {
    return null
  }
}

function nextOrderId(orders: Order[]) {
  const nums = orders.map((order) => Number(order.id.replace('MED-', ''))).filter((value) => Number.isFinite(value))
  const next = Math.max(10040, ...nums) + 1
  return `MED-${next}`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(loadCart)
  const [orders, setOrders] = useState<Order[]>(loadOrders)
  const [coupon, setCoupon] = useState<string | null>(loadCoupon)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(KEYS.cart, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem(KEYS.orders, JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    if (coupon) localStorage.setItem(KEYS.coupon, coupon)
    else localStorage.removeItem(KEYS.coupon)
  }, [coupon])

  function notify(message: string) {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  const detailed = useMemo<CartDetail[]>(
    () =>
      cart.flatMap((line) => {
        const product = getProduct(line.productId)
        return product ? [{ ...line, product }] : []
      }),
    [cart],
  )

  const totals = useMemo(() => {
    const subtotal = detailed.reduce((sum, line) => sum + line.product.price * line.qty, 0)
    return quote(subtotal, coupon === COUPON_CODE)
  }, [detailed, coupon])

  const cartCount = detailed.reduce((sum, line) => sum + line.qty, 0)

  function addToCart(productId: string, qty = 1) {
    const product = getProduct(productId)
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
    const product = getProduct(productId)
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
    if (code.trim().toUpperCase() === COUPON_CODE) {
      setCoupon(COUPON_CODE)
      notify('קופון DEMO10 הופעל')
      return true
    }
    notify('הקוד לא מוכר. לדמו: DEMO10')
    return false
  }

  function clearCoupon() {
    setCoupon(null)
  }

  function placeOrder(customer: Customer) {
    if (detailed.length === 0) return null
    const items = detailed.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      price: line.product.price,
      qty: line.qty,
    }))
    const order: Order = {
      id: nextOrderId(orders),
      createdAt: new Date().toISOString(),
      status: 'received',
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        city: customer.city.trim(),
        address: customer.address.trim(),
      },
      items,
      ...totals,
      coupon: coupon === COUPON_CODE ? COUPON_CODE : undefined,
    }
    setOrders((prev) => [order, ...prev])
    setCart([])
    setCoupon(null)
    return order.id
  }

  function advanceStatus(id: string) {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order
        const index = STATUS_FLOW.indexOf(order.status)
        if (index < 0 || index >= STATUS_FLOW.length - 1) return order
        return { ...order, status: STATUS_FLOW[index + 1] }
      }),
    )
  }

  const value: StoreValue = {
    cart: detailed,
    orders,
    coupon,
    toast,
    totals,
    cartCount,
    addToCart,
    setQty,
    removeFromCart,
    applyCoupon,
    clearCoupon,
    placeOrder,
    advanceStatus,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore מחוץ לספק')
  return value
}
