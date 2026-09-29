import { FormEvent, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { CATEGORIES, STATUS_LABEL } from '../data'
import { money } from '../pricing'
import type { Order, OrderStatus, Product, ShopSettings } from '../types'

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה')
  return data
}

export function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await adminFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      navigate('/admin')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'סיסמה שגויה')
    }
  }

  return (
    <main className="admin-login">
      <form className="panel form" onSubmit={onSubmit}>
        <p className="eyebrow">מדיקה</p>
        <h1>סופר אדמין</h1>
        <label>
          סיסמה
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        </label>
        {error ? <p className="form-errors">{error}</p> : null}
        <button className="btn" type="submit">
          כניסה
        </button>
        <Link to="/">חזרה לחנות</Link>
      </form>
    </main>
  )
}

export function AdminShell() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    adminFetch('/api/admin/me')
      .then(() => setReady(true))
      .catch(() => navigate('/admin/login'))
  }, [navigate])

  if (!ready) return <p className="admin-wait">בודק הרשאה...</p>

  return (
    <div className="admin-app">
      <aside className="admin-side">
        <strong>ניהול מדיקה</strong>
        <NavLink to="/admin" end>
          לוח בקרה
        </NavLink>
        <NavLink to="/admin/products">מוצרים</NavLink>
        <NavLink to="/admin/orders">הזמנות</NavLink>
        <NavLink to="/admin/settings">הגדרות</NavLink>
        <Link to="/">לאתר</Link>
        <button
          type="button"
          onClick={() => {
            void adminFetch('/api/admin/logout', { method: 'POST' }).then(() => navigate('/admin/login'))
          }}
        >
          יציאה
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

type Stats = {
  orders: number
  revenue: number
  open: number
  products: number
  lowStock: Product[]
  recent: Order[]
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => {
    void adminFetch<Stats>('/api/admin/stats').then(setStats)
  }, [])
  if (!stats) return <p>טוען...</p>
  return (
    <div>
      <h1>לוח בקרה</h1>
      <div className="admin-stats">
        <article>
          <span>הזמנות</span>
          <strong>{stats.orders}</strong>
        </article>
        <article>
          <span>פתוחות</span>
          <strong>{stats.open}</strong>
        </article>
        <article>
          <span>מוצרים</span>
          <strong>{stats.products}</strong>
        </article>
        <article>
          <span>מחזור</span>
          <strong>{money(stats.revenue)}</strong>
        </article>
      </div>
      <h2>מלאי נמוך</h2>
      <ul className="admin-list">
        {stats.lowStock.map((product) => (
          <li key={product.id}>
            {product.name} · {product.stock} במלאי
          </li>
        ))}
      </ul>
      <h2>הזמנות אחרונות</h2>
      <ul className="admin-list">
        {stats.recent.map((order) => (
          <li key={order.id}>
            <Link to="/admin/orders">
              {order.id} · {order.customer.name} · {STATUS_LABEL[order.status]} · {money(order.total)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    void adminFetch<Product[]>('/api/admin/products').then(setProducts)
  }, [])

  async function remove(id: string) {
    if (!window.confirm('למחוק את המוצר?')) return
    await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    setProducts((current) => current.filter((product) => product.id !== id))
  }

  return (
    <div>
      <div className="section-head">
        <h1>מוצרים</h1>
        <Link className="btn" to="/admin/products/new">
          מוצר חדש
        </Link>
      </div>
      <div className="admin-table">
        {products.map((product) => (
          <article key={product.id}>
            <img src={product.image} alt="" />
            <div>
              <strong>{product.name}</strong>
              <p>
                {money(product.price)} · מלאי {product.stock} · {product.active ? 'מוצג' : 'מוסתר'}
              </p>
            </div>
            <Link to={`/admin/products/${product.id}`}>עריכה</Link>
            <button type="button" onClick={() => void remove(product.id)}>
              מחיקה
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

const EMPTY = {
  name: '',
  category: 'first-aid',
  price: '0',
  compareAt: '',
  description: '',
  specs: '',
  stock: '0',
  badge: '',
  rating: '4.5',
  reviews: '0',
  image: '',
  active: true,
}

export function AdminProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    void adminFetch<Product[]>('/api/admin/products').then((products) => {
      const product = products.find((item) => item.id === id)
      if (!product) return
      setForm({
        name: product.name,
        category: product.category,
        price: String(product.price),
        compareAt: product.compareAt ? String(product.compareAt) : '',
        description: product.description,
        specs: product.specs.join('\n'),
        stock: String(product.stock),
        badge: product.badge ?? '',
        rating: String(product.rating),
        reviews: String(product.reviews),
        image: product.image ?? '',
        active: product.active !== false,
      })
    })
  }, [id])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const body = new FormData()
    Object.entries(form).forEach(([key, value]) => body.append(key, String(value)))
    if (file) body.append('imageFile', file)
    try {
      await adminFetch(id ? `/api/admin/products/${id}` : '/api/admin/products', {
        method: id ? 'PATCH' : 'POST',
        body,
      })
      navigate('/admin/products')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
    }
  }

  function set(key: keyof typeof EMPTY, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <form className="panel form admin-form" onSubmit={onSubmit}>
      <h1>{id ? 'עריכת מוצר' : 'מוצר חדש'}</h1>
      <label>
        שם
        <input value={form.name} onChange={(event) => set('name', event.target.value)} required />
      </label>
      <label>
        קטגוריה
        <select value={form.category} onChange={(event) => set('category', event.target.value)}>
          {CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <div className="split-fields">
        <label>
          מחיר
          <input value={form.price} onChange={(event) => set('price', event.target.value)} inputMode="numeric" />
        </label>
        <label>
          מחיר לפני הנחה
          <input value={form.compareAt} onChange={(event) => set('compareAt', event.target.value)} inputMode="numeric" />
        </label>
      </div>
      <div className="split-fields">
        <label>
          מלאי
          <input value={form.stock} onChange={(event) => set('stock', event.target.value)} inputMode="numeric" />
        </label>
        <label>
          תג
          <select value={form.badge} onChange={(event) => set('badge', event.target.value)}>
            <option value="">בלי תג</option>
            <option value="new">חדש</option>
            <option value="sale">מבצע</option>
            <option value="popular">נמכר</option>
          </select>
        </label>
      </div>
      <label>
        תיאור
        <textarea value={form.description} onChange={(event) => set('description', event.target.value)} rows={3} />
      </label>
      <label>
        מפרט, שורה לכל פריט
        <textarea value={form.specs} onChange={(event) => set('specs', event.target.value)} rows={4} />
      </label>
      <label>
        כתובת תמונה
        <input value={form.image} onChange={(event) => set('image', event.target.value)} />
      </label>
      <label>
        העלאת תמונה
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} />
        מוצג בחנות
      </label>
      {error ? <p className="form-errors">{error}</p> : null}
      <button className="btn" type="submit">
        שמירה
      </button>
    </form>
  )
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => {
    void adminFetch<Order[]>('/api/admin/orders').then(setOrders)
  }, [])

  async function setStatus(id: string, status: OrderStatus) {
    const updated = await adminFetch<Order>(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOrders((current) => current.map((order) => (order.id === id ? updated : order)))
  }

  return (
    <div>
      <h1>הזמנות</h1>
      <div className="admin-table admin-orders">
        {orders.map((order) => (
          <article key={order.id}>
            <div>
              <strong>{order.id}</strong>
              <p>
                {order.customer.name} · {order.customer.city} · {order.customer.phone}
              </p>
              <p>{order.items.map((item) => `${item.name} × ${item.qty}`).join(' · ')}</p>
            </div>
            <strong>{money(order.total)}</strong>
            <select value={order.status} onChange={(event) => void setStatus(order.id, event.target.value as OrderStatus)}>
              {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </article>
        ))}
      </div>
    </div>
  )
}

export function AdminSettings() {
  const [form, setForm] = useState<ShopSettings | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void adminFetch<ShopSettings>('/api/admin/settings').then(setForm)
  }, [])

  if (!form) return <p>טוען...</p>

  function set<K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  return (
    <form
      className="panel form admin-form"
      onSubmit={(event) => {
        event.preventDefault()
        void adminFetch<ShopSettings>('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }).then((saved) => {
          setForm(saved)
          setMessage('ההגדרות נשמרו')
        })
      }}
    >
      <h1>הגדרות החנות</h1>
      <label>
        שם החנות
        <input value={form.storeName} onChange={(event) => set('storeName', event.target.value)} />
      </label>
      <label>
        שורת משנה
        <input value={form.tagline} onChange={(event) => set('tagline', event.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={form.showBanner} onChange={(event) => set('showBanner', event.target.checked)} />
        הצגת באנר עליון
      </label>
      <label>
        טקסט באנר
        <input value={form.banner} onChange={(event) => set('banner', event.target.value)} />
      </label>
      <div className="split-fields">
        <label>
          דמי משלוח
          <input value={form.shippingFee} onChange={(event) => set('shippingFee', Number(event.target.value))} inputMode="numeric" />
        </label>
        <label>
          משלוח חינם מעל
          <input value={form.freeFrom} onChange={(event) => set('freeFrom', Number(event.target.value))} inputMode="numeric" />
        </label>
      </div>
      <div className="split-fields">
        <label>
          קוד קופון
          <input value={form.couponCode} onChange={(event) => set('couponCode', event.target.value)} />
        </label>
        <label>
          אחוז הנחה
          <input value={form.couponPercent} onChange={(event) => set('couponPercent', Number(event.target.value))} inputMode="numeric" />
        </label>
      </div>
      <label>
        הערת תשלום
        <textarea value={form.paymentNote} onChange={(event) => set('paymentNote', event.target.value)} rows={3} />
      </label>
      <label>
        הערת תחתית
        <textarea value={form.disclaimer} onChange={(event) => set('disclaimer', event.target.value)} rows={3} />
      </label>
      {message ? <p>{message}</p> : null}
      <button className="btn" type="submit">
        שמירת הגדרות
      </button>
    </form>
  )
}
