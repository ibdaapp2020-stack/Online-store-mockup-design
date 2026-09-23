import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { blueprintFor, clubGifts, DATA_VERSION, SEED } from './data'
import { lineKey, quote } from './pricing'
import type { Audience, BusinessAccount, CartLine, ClubProfile, Order, OrderStatus, PlaceInput, Product, RepairRequest } from './types'

const KEYS = {
  version: 'desigma-version',
  products: 'desigma-products',
  cart: 'desigma-cart',
  orders: 'desigma-orders',
  audience: 'desigma-audience',
  admin: 'desigma-admin',
  accounts: 'desigma-accounts',
  business: 'desigma-business',
  club: 'desigma-club',
  repairs: 'desigma-repairs',
}

export const ADMIN_PASSWORD = 'desigma'

type StoreValue = {
  audience: Audience | null
  setAudience: (audience: Audience) => void
  products: Product[]
  cart: CartLine[]
  orders: Order[]
  toast: string
  admin: boolean
  addToCart: (id: string, qty?: number, options?: { color?: string; storage?: string; priceAdd?: number }) => void
  setQty: (key: string, qty: number) => void
  removeFromCart: (key: string) => void
  applySetup: (setupId: string, qty: number) => void
  setSetupQty: (setupId: string, qty: number) => void
  placeOrder: (input: PlaceInput) => string | null
  updateProduct: (id: string, patch: Partial<Product>) => void
  addProduct: (product: Product) => void
  deleteProduct: (id: string) => void
  resetCatalog: () => void
  setOrderStatus: (id: string, status: OrderStatus) => void
  login: (password: string) => boolean
  logout: () => void
  accounts: BusinessAccount[]
  businessUser: BusinessAccount | null
  pricesOpen: boolean
  registerBusiness: (input: Omit<BusinessAccount, 'username' | 'password'>) => { ok: boolean; message: string; account?: BusinessAccount }
  loginBusiness: (username: string, password: string) => boolean
  logoutBusiness: () => void
  club: ClubProfile | null
  joinClub: (input: { name: string; phone: string; email: string }) => boolean
  claimGift: (id: string) => void
  repairs: RepairRequest[]
  submitRepair: (input: Omit<RepairRequest, 'id' | 'createdAt'>) => string
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

function freshVisit() {
  try {
    return localStorage.getItem(KEYS.version) !== DATA_VERSION
  } catch {
    return true
  }
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const product = value as Product
  return typeof product.id === 'string' && typeof product.name === 'string' && typeof product.price === 'number'
}

function loadProducts(): Product[] {
  if (freshVisit()) return SEED.map((product) => ({ ...product, specs: [...product.specs] }))
  const parsed = readJson<unknown>(KEYS.products)
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isProduct)) {
    return SEED.map((product) => ({ ...product, specs: [...product.specs] }))
  }
  return parsed
}

function loadCart(): CartLine[] {
  if (freshVisit()) return []
  const parsed = readJson<CartLine[]>(KEYS.cart)
  if (!Array.isArray(parsed)) return []
  return parsed.filter((line) => line && typeof line.productId === 'string' && line.qty > 0)
}

function loadOrders(): Order[] {
  if (freshVisit()) return []
  const parsed = readJson<Order[]>(KEYS.orders)
  return Array.isArray(parsed) ? parsed : []
}

function loadAudience(): Audience | null {
  try {
    const value = localStorage.getItem(KEYS.audience)
    return value === 'private' || value === 'business' ? value : null
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [audience, setAudienceState] = useState<Audience | null>(loadAudience)
  const [products, setProducts] = useState<Product[]>(loadProducts)
  const [cart, setCart] = useState<CartLine[]>(loadCart)
  const [orders, setOrders] = useState<Order[]>(loadOrders)
  const [toast, setToast] = useState('')
  const [admin, setAdmin] = useState(() => {
    try {
      return sessionStorage.getItem(KEYS.admin) === '1'
    } catch {
      return false
    }
  })
  const [accounts, setAccounts] = useState<BusinessAccount[]>(() => {
    if (freshVisit()) return []
    return readJson<BusinessAccount[]>(KEYS.accounts) ?? []
  })
  const [club, setClub] = useState<ClubProfile | null>(() => {
    if (freshVisit()) return null
    return readJson<ClubProfile>(KEYS.club)
  })
  const [repairs, setRepairs] = useState<RepairRequest[]>(() => {
    if (freshVisit()) return []
    return readJson<RepairRequest[]>(KEYS.repairs) ?? []
  })
  const [businessUser, setBusinessUser] = useState<BusinessAccount | null>(() => {
    try {
      if (freshVisit()) return null
      const username = sessionStorage.getItem(KEYS.business)
      if (!username) return null
      const list = readJson<BusinessAccount[]>(KEYS.accounts) ?? []
      return list.find((account) => account.username === username) ?? null
    } catch {
      return null
    }
  })

  useEffect(() => {
    localStorage.setItem(KEYS.version, DATA_VERSION)
  }, [])

  useEffect(() => {
    localStorage.setItem(KEYS.products, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    localStorage.setItem(KEYS.cart, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem(KEYS.orders, JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem(KEYS.accounts, JSON.stringify(accounts))
  }, [accounts])

  useEffect(() => {
    if (club) localStorage.setItem(KEYS.club, JSON.stringify(club))
  }, [club])

  useEffect(() => {
    localStorage.setItem(KEYS.repairs, JSON.stringify(repairs))
  }, [repairs])

  useEffect(() => {
    if (audience) localStorage.setItem(KEYS.audience, audience)
  }, [audience])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo<StoreValue>(() => {
    const setAudience = (next: Audience) => setAudienceState(next)

    const addToCart = (id: string, qty = 1, options?: { color?: string; storage?: string; priceAdd?: number }) => {
      const product = products.find((item) => item.id === id)
      if (!product || !product.active || product.stock <= 0) {
        setToast('הפריט אזל מהמלאי')
        return
      }
      if (audience === 'business' && !businessUser) {
        setToast('התחברו למחירון העסקי כדי להוסיף לסל')
        return
      }
      const color = options?.color
      const storage = options?.storage
      const priceAdd = options?.priceAdd ?? 0
      setCart((prev) => {
        const index = prev.findIndex((line) => lineKey(line) === lineKey({ productId: id, color, storage }))
        const current = index >= 0 ? prev[index].qty : 0
        const nextQty = Math.min(product.stock, current + qty)
        const nextLine = { productId: id, qty: nextQty, color, storage, priceAdd }
        if (index >= 0) {
          const copy = [...prev]
          copy[index] = nextLine
          return copy
        }
        return [...prev, nextLine]
      })
      setToast('נוסף לסל')
    }

    const setQty = (key: string, qty: number) => {
      const current = cart.find((line) => lineKey(line) === key)
      const product = products.find((item) => item.id === current?.productId)
      if (!current || !product) return
      if (qty <= 0) {
        setCart((prev) => prev.filter((line) => lineKey(line) !== key))
        return
      }
      const nextQty = Math.min(product.stock, qty)
      setCart((prev) => prev.map((line) => (lineKey(line) === key ? { ...line, qty: nextQty } : line)))
    }

    const removeFromCart = (key: string) => {
      setCart((prev) => prev.filter((line) => lineKey(line) !== key))
      setToast('הוסר מהסל')
    }

    const applySetup = (setupId: string, qty: number) => {
      if (!audience) return
      if (audience === 'business' && !businessUser) {
        setToast('התחברו למחירון העסקי כדי להוסיף לסל')
        return
      }
      const ids = blueprintFor(setupId, audience)
      let added = 0
      let skipped = 0
      const next = [...cart]
      for (const id of ids) {
        const product = products.find((item) => item.id === id)
        if (!product || !product.active || product.stock <= 0) {
          skipped += 1
          continue
        }
        const nextQty = Math.max(1, Math.min(qty, product.stock))
        const index = next.findIndex((line) => line.productId === id && !line.color && !line.storage)
        if (index >= 0) next[index] = { productId: id, qty: nextQty }
        else next.push({ productId: id, qty: nextQty })
        added += 1
      }
      setCart(next)
      if (added === 0) setToast('הסטאפ לא זמין כרגע')
      else if (skipped > 0) setToast('הסטאפ נוסף חלקית, יש חוסר במלאי')
      else setToast('הסטאפ נוסף לסל')
    }

    const setSetupQty = (setupId: string, qty: number) => {
      setCart((prev) =>
        prev.map((line) => {
          const product = products.find((item) => item.id === line.productId)
          if (product?.setupId !== setupId) return line
          return { ...line, qty: Math.max(1, Math.min(qty, product.stock)) }
        }),
      )
    }

    const placeOrder = (input: PlaceInput) => {
      if (!audience) return null
      if (audience === 'business' && !businessUser) {
        setToast('התחברו למחירון העסקי כדי להזמין')
        return null
      }
      const priced = quote(products, cart, audience, input.ship)
      const stockIssue = priced.lines.find((line) => line.qty > line.product.stock)
      if (priced.lines.length === 0 || stockIssue) {
        setToast(priced.lines.length === 0 ? 'הסל ריק' : `אין מספיק מלאי ל${stockIssue?.product.name ?? 'פריט'}`)
        return null
      }
      const id = `DS-${Math.floor(10000 + Math.random() * 90000)}`
      const pointsEarned = audience === 'private' && club && input.kind === 'order' ? Math.floor(priced.total / 10) : 0
      if (pointsEarned > 0 && club) {
        setClub({ ...club, points: club.points + pointsEarned, spent: club.spent + priced.total })
      }
      const order: Order = {
        id,
        audience,
        kind: input.kind,
        ship: input.ship,
        payment: input.payment,
        payments: input.payments,
        createdAt: new Date().toISOString(),
        status: 'new',
        lines: priced.lines.map((line) => ({
          productId: line.product.id,
          name: [line.product.name, line.storage, line.color].filter(Boolean).join(' · '),
          qty: line.qty,
          unit: line.unit,
        })),
        discount: priced.discount,
        shipping: priced.shipping,
        vat: priced.vat,
        total: priced.total,
        customer: input.customer,
        invoiceId: input.customer.email ? `INV-${id}` : undefined,
        invoiceSentAt: input.customer.email ? new Date().toISOString() : undefined,
        pointsEarned: pointsEarned || undefined,
      }
      setOrders((prev) => [order, ...prev])
      if (input.kind === 'order') {
        const used = new Map<string, number>()
        for (const line of cart) used.set(line.productId, (used.get(line.productId) ?? 0) + line.qty)
        setProducts((prev) =>
          prev.map((product) => {
            const qty = used.get(product.id) ?? 0
            return qty ? { ...product, stock: Math.max(0, product.stock - qty) } : product
          }),
        )
      }
      setCart([])
      return id
    }

    return {
      audience,
      setAudience,
      products,
      cart,
      orders,
      toast,
      admin,
      addToCart,
      setQty,
      removeFromCart,
      applySetup,
      setSetupQty,
      placeOrder,
      updateProduct: (id, patch) => {
        setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, ...patch } : product)))
      },
      addProduct: (product) => setProducts((prev) => [product, ...prev]),
      deleteProduct: (id) => {
        setProducts((prev) => prev.filter((product) => product.id !== id))
        setCart((prev) => prev.filter((line) => line.productId !== id))
      },
      resetCatalog: () => setProducts(SEED.map((product) => ({ ...product, specs: [...product.specs] }))),
      setOrderStatus: (id, status) => {
        setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, status } : order)))
      },
      login: (password) => {
        if (password.trim() !== ADMIN_PASSWORD) return false
        sessionStorage.setItem(KEYS.admin, '1')
        setAdmin(true)
        return true
      },
      logout: () => {
        sessionStorage.removeItem(KEYS.admin)
        setAdmin(false)
      },
      accounts,
      businessUser,
      pricesOpen: audience !== 'business' || !!businessUser,
      registerBusiness: (input) => {
        const email = input.email.trim().toLowerCase()
        if (input.company.trim().length < 2) return { ok: false, message: 'חסר שם חברה' }
        if (input.hp.replace(/\D/g, '').length !== 9) return { ok: false, message: 'ח.פ צריך 9 ספרות' }
        if (input.contact.trim().length < 2) return { ok: false, message: 'חסר איש קשר' }
        if (input.phone.replace(/\D/g, '').length < 9) return { ok: false, message: 'טלפון לא תקין' }
        if (!email.includes('@')) return { ok: false, message: 'אימייל לא תקין' }
        if (accounts.some((account) => account.email === email || account.username === email)) {
          return { ok: false, message: 'העסק הזה כבר רשום. התחברו עם האימייל.' }
        }
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        const password = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
        const account: BusinessAccount = { ...input, email, username: email, password, company: input.company.trim(), contact: input.contact.trim() }
        setAccounts((prev) => [...prev, account])
        sessionStorage.setItem(KEYS.business, account.username)
        setBusinessUser(account)
        return { ok: true, message: 'החשבון נפתח', account }
      },
      loginBusiness: (username, password) => {
        const account = accounts.find((item) => item.username === username.trim().toLowerCase() && item.password === password.trim())
        if (!account) return false
        sessionStorage.setItem(KEYS.business, account.username)
        setBusinessUser(account)
        return true
      },
      logoutBusiness: () => {
        sessionStorage.removeItem(KEYS.business)
        setBusinessUser(null)
      },
      club,
      joinClub: (input) => {
        const phone = input.phone.replace(/\D/g, '')
        if (input.name.trim().length < 2 || phone.length < 9 || !input.email.includes('@')) return false
        setClub({
          name: input.name.trim(),
          phone,
          email: input.email.trim().toLowerCase(),
          points: club?.points ?? 0,
          spent: club?.spent ?? 0,
          claimed: club?.claimed ?? [],
        })
        setToast('הצטרפתם למועדון')
        return true
      },
      claimGift: (giftId) => {
        const gift = clubGifts.find((item) => item.id === giftId)
        if (!club || !gift || club.spent < gift.spend || club.claimed.includes(giftId)) return
        setClub({ ...club, claimed: [...club.claimed, giftId] })
        setToast('המתנה נרשמה לאיסוף')
      },
      repairs,
      submitRepair: (input) => {
        const id = `LAB-${Math.floor(1000 + Math.random() * 9000)}`
        const request: RepairRequest = { ...input, id, createdAt: new Date().toISOString() }
        setRepairs((prev) => [request, ...prev])
        setToast('הבקשה נקלטה')
        return id
      },
    }
  }, [accounts, admin, audience, businessUser, cart, club, orders, products, repairs, toast])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}
