import { Component, FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { currentUser, resetPassword, watchAuth } from '../lib/data/auth'
import { preferStoredImage, readLiveCatalog, snapshotAdminCatalog } from '../catalog-sync'
import { adminFetch } from '../lib/data/http'
import { productImageErrorView, validateProductImageFile } from '../lib/image-errors'
import { emailAdminFetch } from '../lib/notify'
import { storeUrl } from '../lib/surface'
import { CATEGORIES, STATUS_LABEL } from '../data'
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
        <NavLink to="/categories">קטגוריות</NavLink>
        <NavLink to="/orders">הזמנות</NavLink>
        <NavLink to="/customers">לקוחות</NavLink>
        <NavLink to="/settings">הגדרות</NavLink>
        <span className="admin-nav-label">נוסף</span>
        <NavLink to="/services">תורים</NavLink>
        <NavLink to="/staff">נוכחות</NavLink>
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
        <Link className="btn" to="/orders">הזמנות</Link>
        <Link className="btn secondary" to="/customers">לקוחות</Link>
        <Link className="btn secondary" to="/services">תורים</Link>
        <Link className="btn secondary" to="/staff">נוכחות</Link>
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
  const [categoryNames, setCategoryNames] = useState<Array<{ id: string; name: string }>>(CATEGORIES)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [visibility, setVisibility] = useState('all')
  const [stock, setStock] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void adminFetch<Product[]>('/api/admin/products')
      .then((rows) => {
        const live = readLiveCatalog()
        if (!live?.products.length) {
          setProducts(rows)
          return
        }
        const apiById = new Map(rows.map((product) => [product.id, product]))
        const merged = new Map<string, Product>()
        for (const product of live.products) merged.set(product.id, preferStoredImage(product, apiById.get(product.id)))
        for (const product of rows) if (!merged.has(product.id)) merged.set(product.id, product)
        setProducts([...merged.values()])
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את המוצרים'))
      .finally(() => setLoading(false))
    void adminFetch<Array<{ id: string; name: string }>>('/api/admin/categories')
      .then((rows) => setCategoryNames(rows.length ? rows : CATEGORIES))
      .catch(() => setCategoryNames(storeCategories.length ? storeCategories : CATEGORIES))
  }, [storeCategories])

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
  const categoryOptions = [...new Set(products.map((product) => product.category))].map((id) => ({
    id,
    name: names.get(id) || id,
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
      </div>
      <p className="admin-count">
        {loading ? 'טוען מוצרים...' : `מציג ${visible.length} מתוך ${products.length}`}
        {filtering ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setQuery('')
              setCategory('all')
              setVisibility('all')
              setStock('all')
            }}
          >
            נקה סינון
          </button>
        ) : null}
      </p>
      {error ? <p className="form-errors">{error}</p> : null}
      <div className="admin-table">
        {visible.map((product) => (
          <article key={product.id}>
            <img src={product.image || `/products/${product.id}.png`} alt="" loading="lazy" decoding="async" />
            <div>
              <strong>{product.name}</strong>
              <p>
                {names.get(product.category) || product.category} · {money(product.price)} · מלאי {product.stock} · {product.active ? 'מוצג' : 'מוסתר'}
              </p>
            </div>
            <Link to={`/products/${product.id}`}>עריכה</Link>
            <button type="button" onClick={() => void remove(product.id)}>
              מחיקה
            </button>
          </article>
        ))}
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
      .then((rows) => setCategories(rows.length ? rows : CATEGORIES))
      .catch(() => setCategories(CATEGORIES))
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
          accept="image/jpeg,image/png,image/webp"
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
    <>
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
