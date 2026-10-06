import { Component, FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { currentUser, resetPassword, watchAuth } from '../lib/data/auth'
import { snapshotAdminCatalog } from '../catalog-sync'
import { adminFetch } from '../lib/data/http'
import { watchAdminOrders } from '../lib/data/admin-live'
import { productImageErrorView, validateProductImageFile } from '../lib/image-errors'
import { emailAdminFetch } from '../lib/notify'
import { AccessibilityWidget } from '../components/AccessibilityWidget'
import { storeUrl } from '../lib/surface'
import { STATUS_LABEL } from '../data'
import { money } from '../pricing'
import { useStore } from '../store'
import type { Order, OrderStatus, Product, ShopSettings } from '../types'

export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Admin Portal · PRO PHARM'
    const stop = watchAuth((user) => {
      if (!user) return
      void adminFetch('/api/admin/me')
        .then(() => navigate('/'))
        .catch(() => navigate('/denied'))
    })
    return stop
  }, [navigate])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const data = await adminFetch<{ role?: string }>('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (data.role !== 'ADMIN') {
        navigate('/denied')
        return
      }
      navigate('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'האימייל או הסיסמה שגויים')
    } finally {
      setBusy(false)
    }
  }

  async function onForgot() {
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('הזינו אימייל לשחזור סיסמה')
      return
    }
    setBusy(true)
    try {
      await resetPassword(email)
      setInfo('נשלח קישור לאיפוס סיסמה לאימייל')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לשלוח קישור לאיפוס סיסמה')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-login">
      <form className="panel form" onSubmit={onSubmit}>
        <img className="admin-logo" src="/logo.jpg" alt="PRO PHARM" />
        <h1>PRO PHARM</h1>
        <p className="portal-kicker">Admin Portal</p>
        <label>
          אימייל
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>
          סיסמה
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {error ? <p className="form-errors">{error}</p> : null}
        {info ? <p className="profile-note">{info}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          התחברות
        </button>
        <button className="text-btn" type="button" onClick={() => void onForgot()} disabled={busy}>
          שכחת סיסמה?
        </button>
        <a href={storeUrl('/')}>חזרה לחנות</a>
      </form>
      <AccessibilityWidget />
    </main>
  )
}

export function AdminDenied() {
  const navigate = useNavigate()
  return (
    <main className="admin-login">
      <section className="panel form">
        <img className="admin-logo" src="/logo.jpg" alt="PRO PHARM" />
        <h1>אין גישה</h1>
        <p>החשבון מחובר, אבל אינו מורשה לניהול.</p>
        <button
          className="btn"
          type="button"
          onClick={() => {
            void adminFetch('/api/admin/logout', { method: 'POST' }).then(() => navigate('/login'))
          }}
        >
          יציאה
        </button>
        <a href={storeUrl('/')}>חזרה לחנות</a>
      </section>
    </main>
  )
}

export function AdminShell() {
  const navigate = useNavigate()
  const { refreshCatalog } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.title = 'Admin Portal · PRO PHARM'
    let active = true
    const stop = watchAuth((user) => {
      if (!active) return
      if (!user) {
        navigate('/login')
        return
      }
      void adminFetch('/api/admin/me')
        .then(() => {
          if (active) setReady(true)
        })
        .catch(() => {
          if (active) navigate(currentUser() ? '/denied' : '/login')
        })
    })
    return () => {
      active = false
      stop()
    }
  }, [navigate])

  if (!ready) return <p className="admin-wait">בודק הרשאה...</p>

  return (
    <div className="admin-app">
      <div className="portal-top">
        <strong>PRO PHARM</strong>
        <span>Admin Portal</span>
      </div>
      <aside className="admin-side">
        <img className="admin-logo" src="/logo.jpg" alt="" />
        <strong>PRO PHARM</strong>
        <span className="portal-mark">Admin Portal</span>
        <span className="admin-nav-label">ניהול</span>
        <NavLink to="/" end>
          לוח בקרה
        </NavLink>
        <NavLink to="/products">מוצרים</NavLink>
        <NavLink to="/inventory">מלאי</NavLink>
        <NavLink to="/categories">קטגוריות</NavLink>
        <NavLink to="/orders">הזמנות</NavLink>
        <NavLink to="/customers">לקוחות</NavLink>
        <NavLink to="/banner">באנר</NavLink>
        <NavLink to="/settings">הגדרות</NavLink>
        <span className="admin-nav-label">נוסף</span>
        <NavLink to="/services">תורים</NavLink>
        <NavLink to="/employees">עובדים ונוכחות</NavLink>
        <a
          href={storeUrl('/')}
          onClick={() => {
            void snapshotAdminCatalog().then(() => refreshCatalog())
          }}
        >
          לאתר
        </a>
        <button
          type="button"
          onClick={() => {
            void adminFetch('/api/admin/logout', { method: 'POST' }).then(() => navigate('/login'))
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
      <AccessibilityWidget />
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
          <Link to="/">חזרה ללוח הבקרה</Link>
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
      <Link to="/">חזרה ללוח הבקרה</Link>
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
        <Link to="/inventory" className="metric-link-card">
          <article>
            <span>מלאי נמוך</span>
            <strong style={{ color: stats.lowStock.length > 0 ? '#d97706' : 'inherit' }}>{stats.lowStock.length}</strong>
          </article>
        </Link>
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
        <Link className="btn" to="/orders">הזמנות</Link>
        <Link className="btn secondary" to="/inventory">ניהול מלאי</Link>
        <Link className="btn secondary" to="/banner">שליטה בבאנר</Link>
        <Link className="btn secondary" to="/customers">לקוחות</Link>
        <Link className="btn secondary" to="/services">תורים</Link>
        <Link className="btn secondary" to="/employees">עובדים ונוכחות</Link>
      </div>
      <h2>הזמנות אחרונות</h2>
      <ul className="admin-list">
        {stats.recent.map((order) => (
          <li key={order.id}>
            <Link to="/orders">
              {order.id} · {order.customer.name} · {STATUS_LABEL[order.status]} · {money(order.total)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AdminProducts() {
  const { refreshCatalog, categories: storeCategories } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categoryNames, setCategoryNames] = useState<Array<{ id: string; name: string }>>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [visibility, setVisibility] = useState('all')
  const [stock, setStock] = useState('all')
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'name'>('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void adminFetch<Product[]>('/api/admin/products')
      .then((rows) => setProducts(rows))
      .catch((reason: unknown) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את המוצרים. נסו שוב.')
      })
      .finally(() => setLoading(false))
    void adminFetch<Array<{ id: string; name: string }>>('/api/admin/categories')
      .then((rows) => setCategoryNames(rows))
      .catch((reason) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את הקטגוריות. נסו שוב.')
      })
  }, [])

  async function remove(id: string) {
    if (!window.confirm('למחוק את המוצר?')) return
    await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    setProducts((current) => current.filter((product) => product.id !== id))
    await snapshotAdminCatalog()
    await refreshCatalog()
  }

  const names = new Map<string, string>()
  for (const item of categoryNames) names.set(item.id, item.name)
  for (const item of storeCategories) names.set(item.id, item.name)
  const categoryOptions = categoryNames.map((item) => ({
    id: item.id,
    name: names.get(item.id) || item.name,
  }))
  const needle = query.trim().toLowerCase()
  const visible = products.filter((product) => {
    if (needle && !product.name.toLowerCase().includes(needle)) return false
    if (category !== 'all' && product.category !== category) return false
    if (visibility === 'shown' && product.active === false) return false
    if (visibility === 'hidden' && product.active !== false) return false
    if (stock === 'in' && product.stock <= 0) return false
    if (stock === 'out' && product.stock > 0) return false
    if (stock === 'low' && (product.stock <= 0 || product.stock > 5)) return false
    return true
  })
  const filtering = Boolean(needle || category !== 'all' || visibility !== 'all' || stock !== 'all')

  return (
    <div>
      <div className="section-head">
        <h1>מוצרים</h1>
        <Link className="btn" to="/products/new">
          מוצר חדש
        </Link>
      </div>
      <div className="admin-filters">
        <label>
          חיפוש לפי שם
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="הקלידו שם מוצר" />
        </label>
        <label>
          קטגוריה
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">כל הקטגוריות</option>
            {categoryOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          תצוגה
          <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
            <option value="all">הכל</option>
            <option value="shown">מוצגים באתר</option>
            <option value="hidden">מוסתרים</option>
          </select>
        </label>
        <label>
          מלאי
          <select value={stock} onChange={(event) => setStock(event.target.value)}>
            <option value="all">הכל</option>
            <option value="in">במלאי</option>
            <option value="low">מלאי נמוך</option>
            <option value="out">אזל</option>
          </select>
        </label>
        <label>
          מיון
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
            <option value="default">ברירת מחדל</option>
            <option value="price-asc">מחיר: נמוך לגבוה</option>
            <option value="price-desc">מחיר: גבוה לנמוך</option>
            <option value="stock-asc">מלאי: נמוך לגבוה</option>
            <option value="stock-desc">מלאי: גבוה לנמוך</option>
            <option value="name">שם: א-ת</option>
          </select>
        </label>
      </div>
      <p className="admin-count">
        {loading ? 'טוען מוצרים...' : `מציג ${visible.length} מתוך ${products.length}`}
        {filtering || sortBy !== 'default' ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setQuery('')
              setCategory('all')
              setVisibility('all')
              setStock('all')
              setSortBy('default')
            }}
          >
            נקה סינון ומיון
          </button>
        ) : null}
      </p>
      {error ? <p className="form-errors">{error}</p> : null}
      <div className="admin-table products-admin-table">
        {[...visible]
          .sort((a, b) => {
            if (sortBy === 'price-asc') return a.price - b.price
            if (sortBy === 'price-desc') return b.price - a.price
            if (sortBy === 'stock-asc') return a.stock - b.stock
            if (sortBy === 'stock-desc') return b.stock - a.stock
            if (sortBy === 'name') return a.name.localeCompare(b.name, 'he')
            return 0
          })
          .map((product) => {
            const isOut = product.stock <= 0
            const isLow = product.stock > 0 && product.stock <= 5
            return (
              <article key={product.id} className="product-admin-row">
                <img src={product.image || `/products/${product.id}.png`} alt="" loading="lazy" decoding="async" />
                <div className="product-admin-info">
                  <strong>{product.name}</strong>
                  <div className="product-admin-badges">
                    <span className="badge category-badge">{names.get(product.category) || product.category}</span>
                    <span className="badge price-badge">{money(product.price)}</span>
                    <span className={`badge stock-badge ${isOut ? 'out' : isLow ? 'low' : 'ok'}`}>
                      {isOut ? 'אזל מהמלאי (0)' : isLow ? `מלאי נמוך (${product.stock})` : `מלאי: ${product.stock}`}
                    </span>
                    <span className={`badge ${product.active ? 'status-active' : 'status-hidden'}`}>
                      {product.active ? 'מוצג בחנות' : 'מוסתר'}
                    </span>
                  </div>
                </div>
                <div className="product-admin-actions">
                  <Link className="btn secondary" to={`/products/${product.id}`}>
                    עריכה
                  </Link>
                  <button type="button" className="text-btn danger-text" onClick={() => void remove(product.id)}>
                    מחיקה
                  </button>
                </div>
              </article>
            )
          })}
      </div>
      {!loading && visible.length === 0 ? <p className="empty">לא נמצאו מוצרים לפי החיפוש או הסינון.</p> : null}
    </div>
  )
}

const EMPTY = {
  name: '',
  category: 'first-aid',
  price: '',
  compareAt: '',
  description: '',
  specs: '',
  stock: '',
  badge: '',
  rating: '4.5',
  reviews: '0',
  image: '',
  sizes: '',
  colors: '',
  others: '',
  otherLabel: 'אחר',
  chooseSize: false,
  chooseColor: false,
  chooseOther: false,
  active: true,
  variantStocks: {} as Record<string, string>,
}

function listValues(value: string) {
  return value.split(/[,،|\n]/).map((item) => item.trim()).filter(Boolean)
}

function comboKey(row: { size: string; color: string; other: string }) {
  return `${row.size}|${row.color}|${row.other}`
}

function optionCombos(form: typeof EMPTY) {
  if (!form.chooseSize && !form.chooseColor && !form.chooseOther) return []
  const sizes = form.chooseSize ? listValues(form.sizes) : ['']
  const colors = form.chooseColor ? listValues(form.colors) : ['']
  const others = form.chooseOther ? listValues(form.others) : ['']
  if (form.chooseSize && sizes.length === 0) return []
  if (form.chooseColor && colors.length === 0) return []
  if (form.chooseOther && others.length === 0) return []
  const rows: Array<{ size: string; color: string; other: string }> = []
  for (const size of form.chooseSize ? sizes : ['']) {
    for (const color of form.chooseColor ? colors : ['']) {
      for (const other of form.chooseOther ? others : ['']) rows.push({ size, color, other })
    }
  }
  return rows
}

export function AdminProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refreshCatalog } = useStore()
  const [form, setForm] = useState(EMPTY)
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void adminFetch<Array<{ id: string; name: string }>>('/api/admin/categories')
      .then((rows) => setCategories(rows))
      .catch((reason) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את הקטגוריות. נסו שוב.')
      })
  }, [])

  useEffect(() => {
    if (!id) return
    void adminFetch<Product>(`/api/admin/products/${id}`).then((product) => {
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
        sizes: (product.sizes ?? []).join(', '),
        colors: (product.colors ?? []).join(', '),
        others: (product.choices?.others ?? []).join(', '),
        otherLabel: product.choices?.otherLabel || 'אחר',
        chooseSize: Boolean(product.choices?.size || product.sizes?.length),
        chooseColor: Boolean(product.choices?.color || product.colors?.length),
        chooseOther: Boolean(product.choices?.other),
        active: product.active !== false,
        variantStocks: Object.fromEntries((product.variants ?? []).map((row) => [comboKey(row), String(row.stock)])),
      })
    })
  }, [id])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const body = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'variantStocks') return
      body.append(key, String(value))
    })
    const combos = optionCombos(form)
    body.append('choices', JSON.stringify({
      size: form.chooseSize,
      color: form.chooseColor,
      other: form.chooseOther,
      otherLabel: form.otherLabel,
      others: listValues(form.others),
    }))
    body.append('variants', JSON.stringify(combos.map((row) => ({ ...row, stock: Number(form.variantStocks[comboKey(row)] || 0) }))))
    if (file) body.append('imageFile', file)
    setSaving(true)
    try {
      await adminFetch(id ? `/api/admin/products/${id}` : '/api/admin/products', {
        method: id ? 'PATCH' : 'POST',
        body,
      })
      await snapshotAdminCatalog()
      await refreshCatalog()
      navigate('/products')
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : ''
      const code = reason && typeof reason === 'object' && 'code' in reason ? String((reason as { code?: string }).code || '') : ''
      const uploadFailed =
        code.startsWith('image/') ||
        code.startsWith('storage/') ||
        /unauthorized|storage|העלות את התמונה|jpg, png|10mb|גדולה מדי/i.test(`${code} ${raw}`)
      if (uploadFailed) {
        const image = productImageErrorView(reason)
        setError(`${image.title}. ${image.message}`)
      } else {
        setError(raw || 'שמירה נכשלה')
      }
    } finally {
      setSaving(false)
    }
  }

  function set(key: keyof typeof EMPTY, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const combos = useMemo(() => optionCombos(form), [form])

  return (
    <form className="panel form admin-form" onSubmit={onSubmit}>
      <h1>{id ? 'עריכת מוצר' : 'מוצר חדש'}</h1>
      <p className="muted">חובה: שם, קטגוריה, מחיר וכמות. שאר השדות אופציונליים.</p>
      <label>
        שם
        <input value={form.name} onChange={(event) => set('name', event.target.value)} required />
      </label>
      <label>
        קטגוריה
        <select value={form.category} onChange={(event) => set('category', event.target.value)} required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <div className="split-fields">
        <label>
          מחיר
          <input value={form.price} onChange={(event) => set('price', event.target.value)} inputMode="numeric" required />
        </label>
        <label>
          מחיר לפני הנחה
          <input value={form.compareAt} onChange={(event) => set('compareAt', event.target.value)} inputMode="numeric" placeholder="לא חובה" />
        </label>
      </div>
      <div className="split-fields">
        <label>
          כמות
          <input value={form.stock} onChange={(event) => set('stock', event.target.value)} inputMode="numeric" required />
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
        <textarea value={form.description} onChange={(event) => set('description', event.target.value)} rows={3} placeholder="לא חובה" />
      </label>
      <label>
        מפרט, שורה לכל פריט
        <textarea value={form.specs} onChange={(event) => set('specs', event.target.value)} rows={4} placeholder="לא חובה" />
      </label>
      <div className="choice-row">
        <label className="check">
          <input type="checkbox" checked={form.chooseSize} onChange={(event) => set('chooseSize', event.target.checked)} />
          מידה
        </label>
        <label className="check">
          <input type="checkbox" checked={form.chooseColor} onChange={(event) => set('chooseColor', event.target.checked)} />
          צבע
        </label>
        <label className="check">
          <input type="checkbox" checked={form.chooseOther} onChange={(event) => set('chooseOther', event.target.checked)} />
          אפשרות נוספת
        </label>
      </div>
      {form.chooseSize ? (
        <label>
          מידות, מופרדות בפסיק. לדוגמה S, M, L, XL
          <input value={form.sizes} onChange={(event) => set('sizes', event.target.value)} />
        </label>
      ) : null}
      {form.chooseColor ? (
        <label>
          צבעים, מופרדים בפסיק
          <input value={form.colors} onChange={(event) => set('colors', event.target.value)} />
        </label>
      ) : null}
      {form.chooseOther ? (
        <div className="split-fields">
          <label>
            שם האפשרות
            <input value={form.otherLabel} onChange={(event) => set('otherLabel', event.target.value)} />
          </label>
          <label>
            ערכים, מופרדים בפסיק
            <input value={form.others} onChange={(event) => set('others', event.target.value)} />
          </label>
        </div>
      ) : null}
      {combos.length ? (
        <div className="stack-list">
          <strong>מלאי לכל בחירה</strong>
          {combos.map((row) => (
            <label key={comboKey(row)}>
              {[row.size, row.color, row.other].filter(Boolean).join(' · ')}
              <input
                inputMode="numeric"
                value={form.variantStocks[comboKey(row)] ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, variantStocks: { ...current.variantStocks, [comboKey(row)]: event.target.value } }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}
      <label>
        כתובת תמונה
        <input value={form.image} onChange={(event) => set('image', event.target.value)} placeholder="לא חובה" />
      </label>
      <label>
        העלאת תמונה
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null
            setError('')
            if (!next) {
              setFile(null)
              return
            }
            try {
              validateProductImageFile(next)
              setFile(next)
            } catch (reason) {
              setFile(null)
              event.target.value = ''
              const view = productImageErrorView(reason)
              setError(`${view.title}. ${view.message}`)
            }
          }}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} />
        מוצג בחנות
      </label>
      {error ? <p className="form-errors">{error}</p> : null}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? 'שומר...' : 'שמירה'}
      </button>
    </form>
  )
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    return watchAdminOrders(
      (rows) => {
        setOrders(rows)
        setLoadError('')
        setLoading(false)
      },
      (reason) => {
        console.error(reason)
        setLoadError('לא הצלחנו לטעון את ההזמנות. נסו שוב.')
        setLoading(false)
      },
    )
  }, [])

  async function setStatus(id: string, status: OrderStatus) {
    const updated = await adminFetch<Order>(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOrders((current) => current.map((order) => (order.id === id ? updated : order)))
  }

  function formatOrderTime(iso: string) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('he-IL', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function cleanPhone(phone: string) {
    return phone.replace(/\D/g, '')
  }

  function waLink(phone: string, orderId: string, name: string) {
    const digits = cleanPhone(phone)
    const intl = digits.startsWith('0') ? `972${digits.slice(1)}` : digits
    return `https://wa.me/${intl}?text=${encodeURIComponent(`שלום ${name}, לגבי הזמנתך מספר ${orderId} ב-PRO PHARM:`)}`
  }

  const needle = query.trim().toLowerCase()
  const visible = orders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false
    if (needle) {
      const matchId = order.id.toLowerCase().includes(needle)
      const matchName = order.customer.name.toLowerCase().includes(needle)
      const matchPhone = order.customer.phone.toLowerCase().includes(needle)
      const matchCity = (order.customer.city || '').toLowerCase().includes(needle)
      if (!matchId && !matchName && !matchPhone && !matchCity) return false
    }
    return true
  })

  return (
    <div className="orders-page">
      <div className="section-head">
        <div>
          <h1>ניהול הזמנות</h1>
          <p className="admin-lede">פירוט מלא של כל ההזמנות: פרטי הלקוח, כתובת למשלוח, תאריך ושעה מדויקים, ועדכון סטטוס מהיר.</p>
        </div>
      </div>

      <div className="orders-filter-bar">
        <div className="choice-row">
          <button type="button" className={statusFilter === 'all' ? 'choice on' : 'choice'} onClick={() => setStatusFilter('all')}>
            הכל ({orders.length})
          </button>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((st) => {
            const count = orders.filter((o) => o.status === st).length
            return (
              <button key={st} type="button" className={statusFilter === st ? 'choice on' : 'choice'} onClick={() => setStatusFilter(st)}>
                {STATUS_LABEL[st]} ({count})
              </button>
            )
          })}
        </div>

        <div className="orders-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון, עיר או מספר הזמנה..."
          />
        </div>
      </div>

      {loading ? <p className="muted">טוען הזמנות...</p> : null}
      {loadError ? <p className="form-errors">{loadError}</p> : null}
      {!loading && !loadError && visible.length === 0 ? <p className="empty">לא נמצאו הזמנות התואמות לחיפוש או לסטטוס שנבחר.</p> : null}

      <div className="orders-cards-list">
        {visible.map((order) => (
          <article className={`order-card-detailed status-border-${order.status}`} key={order.id}>
            <header className="order-card-header">
              <div className="order-title-group">
                <strong className="order-id-badge">#{order.id}</strong>
                <span className="order-time-text">🕒 {formatOrderTime(order.createdAt)}</span>
              </div>
              <div className="order-status-control">
                <span className={`badge order-status-badge status-${order.status}`}>
                  {STATUS_LABEL[order.status]}
                </span>
                <select
                  className="order-status-select"
                  value={order.status}
                  onChange={(event) => void setStatus(order.id, event.target.value as OrderStatus)}
                >
                  {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((status) => (
                    <option key={status} value={status}>
                      עדכן ל: {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            {/* פרטי המזמין והמשלוח */}
            <div className="order-customer-box">
              <div className="customer-info-col">
                <span className="info-label">שם המזמין:</span>
                <strong>{order.customer.name}</strong>
              </div>
              <div className="customer-info-col">
                <span className="info-label">טלפון וקשר:</span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <a href={`tel:${order.customer.phone}`} dir="ltr" style={{ fontWeight: 700 }}>
                    {order.customer.phone}
                  </a>
                  <a
                    className="wa-btn-mini"
                    href={waLink(order.customer.phone, order.id, order.customer.name)}
                    target="_blank"
                    rel="noreferrer"
                    title="שלח וואטסאפ ללקוח"
                  >
                    וואטסאפ
                  </a>
                </div>
              </div>
              <div className="customer-info-col">
                <span className="info-label">אימייל:</span>
                <span>{order.customer.email || 'לא צוין'}</span>
              </div>
              <div className="customer-info-col" style={{ gridColumn: 'span 2' }}>
                <span className="info-label">כתובת מלאה למשלוח:</span>
                <strong>
                  📍 {order.customer.city}{order.customer.address ? `, ${order.customer.address}` : ''}
                </strong>
              </div>
            </div>

            {/* רשימת הפריטים */}
            <div className="order-items-table">
              <div className="order-items-head">
                <span>מוצר</span>
                <span>מאפיינים</span>
                <span>כמות</span>
                <span>מחיר יחידה</span>
                <span>סה״כ</span>
              </div>
              {order.items.map((item, index) => (
                <div className="order-items-row" key={`${item.productId}-${index}`}>
                  <span className="item-name">{item.name}</span>
                  <span className="item-variant">
                    {[item.size ? `מידה: ${item.size}` : '', item.color ? `צבע: ${item.color}` : ''].filter(Boolean).join(' | ') || 'רגיל'}
                  </span>
                  <span className="item-qty">× {item.qty}</span>
                  <span className="item-price">{money(item.price)}</span>
                  <strong className="item-total">{money(item.price * item.qty)}</strong>
                </div>
              ))}
            </div>

            {/* סיכום כספי */}
            <footer className="order-card-footer">
              <div className="order-summary-breakdown">
                <span>סכום ביניים: {money(order.subtotal)}</span>
                <span>משלוח: {order.shipping === 0 ? 'חינם' : money(order.shipping)}</span>
                {order.discount ? <span className="discount-tag">הנחה {order.coupon ? `(${order.coupon})` : ''}: −{money(order.discount)}</span> : null}
              </div>
              <div className="order-final-total">
                <span>סה״כ לתשלום:</span>
                <strong>{money(order.total)}</strong>
              </div>
            </footer>
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
    <>
    <form
      className="panel form admin-form settings-organized"
      onSubmit={(event) => {
        event.preventDefault()
        void adminFetch<ShopSettings>('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }).then((saved) => {
          setForm(saved)
          setMessage('ההגדרות נשמרו בהצלחה!')
        })
      }}
    >
      <div className="section-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>הגדרות החנות</h1>
          <p className="admin-lede">הגדרת פרטי העסק, מבצעים והנחות, משלוחים, מועדון לקוחות והודעות.</p>
        </div>
        <button className="btn" type="submit">
          שמירת הגדרות ✓
        </button>
      </div>

      {message ? <p className="profile-note">{message}</p> : null}

      {/* 1. פרטי העסק */}
      <div className="settings-group">
        <h3>1. פרטי החנות והסלוגן</h3>
        <label>
          שם החנות
          <input value={form.storeName} onChange={(event) => set('storeName', event.target.value)} />
        </label>
        <label>
          שורת משנה (סלוגן מופיע מתחת ללוגו)
          <input value={form.tagline} onChange={(event) => set('tagline', event.target.value)} />
        </label>
      </div>

      {/* 2. הנחות ומבצעים לכל האתר */}
      <div className="settings-group">
        <h3>2. הנחות ומבצעים לכל האתר</h3>
        <div className="split-fields">
          <label>
            הנחה כללית לכל האתר (%)
            <input
              type="number"
              min={0}
              max={90}
              value={form.siteDiscountPercent || 0}
              onChange={(event) => set('siteDiscountPercent', Number(event.target.value) || 0)}
              placeholder="0 (ללא הנחה גורפת)"
            />
          </label>
          <label>
            קוד קופון ראשי
            <input value={form.couponCode} onChange={(event) => set('couponCode', event.target.value)} />
          </label>
        </div>
        <div className="split-fields">
          <label>
            אחוז הנחה לקופון הראשי (%)
            <input value={form.couponPercent} onChange={(event) => set('couponPercent', Number(event.target.value))} inputMode="numeric" />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.2rem' }}>
            <span className="muted">
              {form.siteDiscountPercent ? `פעילה הנחה כללית של ${form.siteDiscountPercent}% לכל האתר.` : 'אין כרגע הנחה כללית מופעלת.'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. פס הודעות עליון */}
      <div className="settings-group">
        <h3>3. פס הודעות עליון בכל האתר (Announcement Bar)</h3>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          הפס הזה מופיע מעל התפריט הראשי בכל דפי האתר. משמש להודעות שיווקיות חשובות.
        </p>
        <label className="check" style={{ margin: '0.8rem 0' }}>
          <input type="checkbox" checked={form.showBanner} onChange={(event) => set('showBanner', event.target.checked)} />
          <strong>הפעל והצג את פס ההודעות בראש האתר</strong>
        </label>
        {form.showBanner ? (
          <div className="banner-preview-box" style={{ margin: '0.6rem 0' }}>
            <span className="muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>תצוגה מקדימה:</span>
            <div className="demo-banner-preview">{form.banner || 'הקלידו טקסט לפס העליון'}</div>
          </div>
        ) : null}
        <label>
          טקסט ההודעה בפס העליון
          <input value={form.banner} onChange={(event) => set('banner', event.target.value)} placeholder="למשל: משלוח חינם מעל ₪199 | התאמת מדרסים בסניף" />
        </label>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
          רוצים לשלוט בבאנר המתחלף במסך הבית? עברו ללשונית <Link to="/banner">באנר</Link> בסרגל הניהול.
        </p>
      </div>

      {/* 4. משלוחים */}
      <div className="settings-group">
        <h3>4. מדיניות משלוחים</h3>
        <div className="split-fields">
          <label>
            דמי משלוח רגילים (₪)
            <input value={form.shippingFee} onChange={(event) => set('shippingFee', Number(event.target.value))} inputMode="numeric" />
          </label>
          <label>
            משלוח חינם בקנייה מעל (₪)
            <input value={form.freeFrom} onChange={(event) => set('freeFrom', Number(event.target.value))} inputMode="numeric" />
          </label>
        </div>
      </div>

      {/* 5. מועדון לקוחות */}
      <div className="settings-group">
        <h3>5. מועדון לקוחות והטבות</h3>
        <label>
          אופן צבירת הטבות במועדון
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
            אחוז לקנייה הבאה (%)
            <input value={form.clubPercent} onChange={(event) => set('clubPercent', Number(event.target.value))} inputMode="numeric" />
          </label>
        </div>
      </div>

      {/* 6. הערות ותנאים */}
      <div className="settings-group">
        <h3>6. הערות תשלום ותחתית</h3>
        <label>
          הערת תשלום (מופיעה בקופה)
          <textarea value={form.paymentNote} onChange={(event) => set('paymentNote', event.target.value)} rows={2} />
        </label>
        <label>
          הערת תחתית (מופיעה בפוטר של האתר)
          <textarea value={form.disclaimer} onChange={(event) => set('disclaimer', event.target.value)} rows={2} />
        </label>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
        <button className="btn" type="submit">
          שמירת כל ההגדרות ✓
        </button>
        {message ? <span className="profile-note" style={{ margin: 0 }}>{message}</span> : null}
      </div>
    </form>
    <AdminEmailSettings />
    </>
  )
}

type EmailStatus = {
  provider: string
  sender: string
  adminEmail: string
  connected: boolean
  error?: string
  flags: Record<string, boolean>
}

type EmailDelivery = {
  id: string
  createdAt: string
  type: string
  recipient: string
  entityId: string
  status: string
  provider: string
  providerMessageId?: string
  errorCode?: string
  subject?: string
}

const FLAG_LABELS: Array<[string, string]> = [
  ['newOrder', 'הזמנה חדשה'],
  ['paymentReceived', 'תשלום שהתקבל'],
  ['paymentProblem', 'בעיית תשלום'],
  ['orderCancelled', 'הזמנה שבוטלה'],
  ['lowStock', 'מלאי נמוך'],
  ['outOfStock', 'אזל מהמלאי'],
  ['systemAlerts', 'התראות מערכת חשובות'],
]

export function AdminEmailSettings() {
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([])
  const [preview, setPreview] = useState('')
  const [to, setTo] = useState('abulieltasneem23@gmail.com')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<EmailDelivery | null>(null)

  async function load() {
    const next = await emailAdminFetch<EmailStatus>('/api/admin/email/status')
    setStatus(next)
    setDeliveries(await emailAdminFetch<EmailDelivery[]>('/api/admin/email/deliveries'))
  }

  useEffect(() => {
    void load().catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'לא ניתן לטעון את מערכת המייל'))
  }, [])

  async function saveFlags(flags: Record<string, boolean>) {
    const saved = await emailAdminFetch<Record<string, boolean>>('/api/admin/email/settings', {
      method: 'PATCH',
      body: JSON.stringify(flags),
    })
    setStatus((current) => (current ? { ...current, flags: saved } : current))
  }

  if (!status) return <p>טוען התראות...</p>

  return (
    <section className="panel form admin-form email-settings">
      <h2>התראות ומיילים</h2>
      <p>Sender: {status.sender}</p>
      <p>Management recipient: {status.adminEmail}</p>
      <p>Provider: {status.provider}</p>
      <p>Connection status: {status.connected ? 'Connected' : `Error${status.error ? ` — ${status.error}` : ''}`}</p>
      <div className="email-flags">
        {FLAG_LABELS.map(([key, label]) => (
          <label key={key} className="check">
            <input
              type="checkbox"
              checked={status.flags[key] !== false}
              onChange={(event) => {
                void saveFlags({ ...status.flags, [key]: event.target.checked })
              }}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="split-fields">
        <label>
          נמען לבדיקה
          <input type="email" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      <div className="admin-links">
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setMessage('')
            void emailAdminFetch<{ status: string; providerMessageId?: string; errorCode?: string }>('/api/admin/email/test', {
              method: 'POST',
              body: JSON.stringify({ to }),
            })
              .then((result) => {
                setMessage(result.status === 'SENT' ? `נשלח. מזהה Brevo: ${result.providerMessageId || 'אין'}` : `נכשל: ${result.errorCode || result.status}`)
                void load()
              })
              .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'שליחת הבדיקה נכשלה'))
              .finally(() => setBusy(false))
          }}
        >
          שלח מייל בדיקה
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            void emailAdminFetch<{ html: string }>('/api/admin/email/preview?type=test&lang=he').then((result) => setPreview(result.html))
          }}
        >
          תצוגה מקדימה
        </button>
      </div>
      {message ? <p>{message}</p> : null}
      {preview ? <iframe className="email-preview" title="תצוגת מייל בדיקה" srcDoc={preview} /> : null}
      <h3>היסטוריית משלוחים</h3>
      <div className="admin-table email-history">
        {deliveries.map((row) => (
          <article key={row.id} onClick={() => setOpen(row)}>
            <div>
              <strong>{row.type}</strong>
              <p>{new Date(row.createdAt).toLocaleString('he-IL')} · {row.recipient}</p>
              <p>{row.entityId || '—'}</p>
            </div>
            <span>{row.status}</span>
            <span>{row.provider}</span>
          </article>
        ))}
      </div>
      {open ? (
        <div className="panel">
          <h3>{open.subject || open.type}</h3>
          <p>אל: {open.recipient}</p>
          <p>סטטוס: {open.status}</p>
          <p>מזהה ספק: {open.providerMessageId || '—'}</p>
          <p>שגיאה: {open.errorCode || '—'}</p>
          <button className="text-btn" type="button" onClick={() => setOpen(null)}>
            סגירה
          </button>
        </div>
      ) : null}
    </section>
  )
}
