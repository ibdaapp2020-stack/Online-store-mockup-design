import { Component, FormEvent, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { snapshotAdminCatalog } from '../catalog-sync'
import { STATUS_LABEL } from '../data'
import { money } from '../pricing'
import { useStore } from '../store'
import type { Order, OrderStatus, Product, ShopSettings } from '../types'

export { ProductList as AdminProducts } from '../admin/products/ProductList'
export { ProductFormPage as AdminProductForm } from '../admin/products/ProductForm'

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה')
  return data
}

export function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('propharm')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await adminFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      navigate('/admin')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שם המשתמש או הסיסמה שגויים')
    }
  }

  return (
    <main className="admin-login">
      <form className="panel form" onSubmit={onSubmit}>
        <img className="admin-logo" src="/logo.jpg" alt="PRO PHARM" />
        <h1>סופר אדמין</h1>
        <label>
          שם משתמש
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus />
        </label>
        <label>
          סיסמה
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
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
  const { refreshCatalog } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.title = 'ניהול · PRO PHARM'
    let active = true
    fetch('/api/admin/me', { credentials: 'include' })
      .then((response) => {
        if (!active) return
        if (response.status === 401) navigate('/admin/login')
        else setReady(true)
      })
      .catch(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [navigate])

  if (!ready) return <p className="admin-wait">בודק הרשאה...</p>

  return (
    <div className="admin-app">
      <aside className="admin-side">
        <img className="admin-logo" src="/logo.jpg" alt="" />
        <strong>PRO PHARM</strong>
        <span className="admin-nav-label">חנות</span>
        <NavLink to="/admin" end>
          לוח בקרה
        </NavLink>
        <NavLink to="/admin/products">מוצרים</NavLink>
        <NavLink to="/admin/categories">קטגוריות</NavLink>
        <NavLink to="/admin/orders">הזמנות</NavLink>
        <span className="admin-nav-label">לקוחות</span>
        <NavLink to="/admin/services">תורים</NavLink>
        <NavLink to="/admin/club">מועדון</NavLink>
        <span className="admin-nav-label">צוות</span>
        <NavLink to="/admin/staff">נוכחות</NavLink>
        <NavLink to="/admin/settings">הגדרות</NavLink>
        <Link to="/" onClick={() => void snapshotAdminCatalog().then(() => refreshCatalog())}>
          לאתר
        </Link>
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
        <AdminBoundary>
          <Outlet />
        </AdminBoundary>
      </main>
    </div>
  )
}

class AdminBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'המסך נתקל בשגיאה' }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel">
          <h1>המסך לא נטען</h1>
          <p>{this.state.error}</p>
          <Link to="/admin">חזרה ללוח הבקרה</Link>
        </div>
      )
    }
    return this.props.children
  }
}

export function AdminMissing() {
  return (
    <div className="panel">
      <h1>העמוד לא נמצא בניהול</h1>
      <Link to="/admin">חזרה ללוח הבקרה</Link>
    </div>
  )
}

type Stats = {
  orders: number
  revenue: number
  open: number
  products: number
  customers: number
  appointments: number
  employees: number
  lowStock: Product[]
  recent: Order[]
  daily?: Array<{ date: string; total: number; count: number }>
  pipeline?: Record<string, number>
}

const PIPELINE = [
  ['received', 'התקבלה'],
  ['packing', 'באריזה'],
  ['shipped', 'נשלחה'],
  ['delivered', 'נמסרה'],
] as const

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
        <article>
          <span>לקוחות במועדון</span>
          <strong>{stats.customers}</strong>
        </article>
        <article>
          <span>תורים פתוחים</span>
          <strong>{stats.appointments}</strong>
        </article>
        <article>
          <span>עובדים</span>
          <strong>{stats.employees}</strong>
        </article>
        <article>
          <span>מלאי נמוך</span>
          <strong>{stats.lowStock.length}</strong>
        </article>
      </div>
      <div className="chart-grid">
        <section className="panel">
          <h2>מחזור 7 ימים</h2>
          <div className="bars">
            {(stats.daily ?? []).map((day) => {
              const max = Math.max(1, ...(stats.daily ?? []).map((item) => item.total))
              return (
                <div key={day.date} className="bar">
                  <span style={{ height: `${Math.max(8, (day.total / max) * 100)}%` }} title={money(day.total)} />
                  <small>{day.date}</small>
                </div>
              )
            })}
          </div>
        </section>
        <section className="panel">
          <h2>מעקב הזמנות</h2>
          <div className="pipeline">
            {PIPELINE.map(([key, label]) => (
              <article key={key}>
                <strong>{stats.pipeline?.[key] ?? 0}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className="admin-links">
        <Link className="btn" to="/admin/orders">הזמנות</Link>
        <Link className="btn secondary" to="/admin/services">תורים</Link>
        <Link className="btn secondary" to="/admin/club">מועדון</Link>
        <Link className="btn secondary" to="/admin/staff">נוכחות</Link>
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
              <p>{order.items.map((item) => `${item.name}${item.size ? ` ${item.size}` : ''}${item.color ? ` ${item.color}` : ''} × ${item.qty}`).join(' · ')}</p>
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
          void snapshotAdminCatalog()
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
      <h2>מלאי ומע״מ</h2>
      <div className="split-fields">
        <label>
          סף מלאי נמוך
          <input value={form.lowStockThreshold ?? 5} onChange={(event) => set('lowStockThreshold', Number(event.target.value))} inputMode="numeric" />
        </label>
        <label>
          אחוז מע״מ
          <input value={form.vatRate ?? 18} onChange={(event) => set('vatRate', Number(event.target.value))} inputMode="decimal" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.vatIncluded !== false} onChange={(event) => set('vatIncluded', event.target.checked)} />
        המחירים כוללים מע״מ
      </label>
      <label className="check">
        <input type="checkbox" checked={Boolean(form.allowSellWithoutStock)} onChange={(event) => set('allowSellWithoutStock', event.target.checked)} />
        לאפשר מכירה כשאין מלאי
      </label>
      <h2>מועדון לקוחות</h2>
      <label>
        אופן צבירה
        <select value={form.loyaltyMode} onChange={(event) => set('loyaltyMode', event.target.value as ShopSettings['loyaltyMode'])}>
          <option value="points">נקודות לכל קנייה</option>
          <option value="percent">אחוז הנחה לקנייה הבאה</option>
        </select>
      </label>
      <div className="split-fields">
        <label>
          נקודות לכל 100 ₪
          <input value={form.pointsPer100} onChange={(event) => set('pointsPer100', Number(event.target.value))} inputMode="numeric" />
        </label>
        <label>
          אחוז לקנייה הבאה
          <input value={form.clubPercent} onChange={(event) => set('clubPercent', Number(event.target.value))} inputMode="numeric" />
        </label>
      </div>
      <h2>עדכון מייל על הזמנה</h2>
      <label>
        אימייל לקבלת הזמנות
        <input value={form.notifyEmail} onChange={(event) => set('notifyEmail', event.target.value)} />
      </label>
      <label>
        משתמש Gmail לשליחה
        <input value={form.smtpUser} onChange={(event) => set('smtpUser', event.target.value)} />
      </label>
      <label>
        סיסמת אפליקציה של Gmail
        <input
          type="password"
          value={form.smtpPass ?? ''}
          placeholder={form.smtpConfigured ? 'שמורה. מלאו רק כדי להחליף' : 'נדרשת כדי שהמייל ייצא'}
          onChange={(event) => set('smtpPass', event.target.value)}
          autoComplete="new-password"
        />
      </label>
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
