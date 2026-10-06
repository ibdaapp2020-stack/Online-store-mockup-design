import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { snapshotAdminCatalog } from '../catalog-sync'
import { adminFetch } from '../lib/data/http'
import { money } from '../pricing'
import { useStore } from '../store'
import type { Product } from '../types'

export function AdminInventory() {
  const { refreshCatalog, categories } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'ok'>('all')
  const [sort, setSort] = useState<'stock-asc' | 'stock-desc' | 'name' | 'price-asc' | 'price-desc'>('stock-asc')
  const [stagedStock, setStagedStock] = useState<Record<string, number>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const categoryNames = new Map<string, string>()
  for (const cat of categories) categoryNames.set(cat.id, cat.name)

  async function load() {
    try {
      setLoading(true)
      const rows = await adminFetch<Product[]>('/api/admin/products')
      setProducts(rows)
      const stockMap: Record<string, number> = {}
      for (const p of rows) stockMap[p.id] = p.stock
      setStagedStock(stockMap)
      setError('')
    } catch (reason) {
      console.error(reason)
      setError('לא הצלחנו לטעון את המלאי.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function updateStaged(id: string, delta: number) {
    setStagedStock((prev) => {
      const current = prev[id] ?? 0
      return { ...prev, [id]: Math.max(0, current + delta) }
    })
  }

  function setStagedValue(id: string, val: number) {
    setStagedStock((prev) => ({ ...prev, [id]: Math.max(0, val) }))
  }

  async function saveStock(product: Product) {
    const nextStock = stagedStock[product.id] ?? product.stock
    setSavingId(product.id)
    setError('')
    setNotice('')
    try {
      const updated = await adminFetch<Product>(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: nextStock }),
      })
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
      setNotice(`המלאי של "${product.name}" עודכן ל-${nextStock}`)
      await snapshotAdminCatalog()
      await refreshCatalog()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'עדכון המלאי נכשל')
    } finally {
      setSavingId(null)
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`למחוק את "${product.name}" מהמלאי והחנות?`)) return
    setError('')
    setNotice('')
    try {
      await adminFetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setNotice(`המוצר "${product.name}" הוסר בהצלחה`)
      await snapshotAdminCatalog()
      await refreshCatalog()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'המחיקה נכשלה')
    }
  }

  // Counts
  const totalCount = products.length
  const outCount = products.filter((p) => p.stock <= 0).length
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length
  const okCount = products.filter((p) => p.stock > 5).length

  // Filter & sort
  const needle = query.trim().toLowerCase()
  const visible = products
    .filter((product) => {
      if (needle && !product.name.toLowerCase().includes(needle) && !product.id.toLowerCase().includes(needle)) {
        return false
      }
      if (filter === 'out' && product.stock > 0) return false
      if (filter === 'low' && (product.stock <= 0 || product.stock > 5)) return false
      if (filter === 'ok' && product.stock <= 5) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'stock-asc') return a.stock - b.stock
      if (sort === 'stock-desc') return b.stock - a.stock
      if (sort === 'name') return a.name.localeCompare(b.name, 'he')
      if (sort === 'price-asc') return a.price - b.price
      if (sort === 'price-desc') return b.price - a.price
      return 0
    })

  return (
    <div className="inventory-page">
      <div className="section-head">
        <div>
          <h1>ניהול מלאי</h1>
          <p className="admin-lede">מעקב ועריכת כמויות מלאי לכל המוצרים. כל שינוי מתעדכן מיידית בחנות.</p>
        </div>
        <Link className="btn" to="/products/new">
          + מוצר חדש
        </Link>
      </div>

      <div className="inventory-metrics">
        <button type="button" className={`metric-card ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <span>סה״כ פריטים</span>
          <strong>{totalCount}</strong>
        </button>
        <button type="button" className={`metric-card metric-low ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>
          <span>מלאי נמוך (1-5)</span>
          <strong>{lowCount}</strong>
        </button>
        <button type="button" className={`metric-card metric-out ${filter === 'out' ? 'active' : ''}`} onClick={() => setFilter('out')}>
          <span>אזלו מהמלאי (0)</span>
          <strong>{outCount}</strong>
        </button>
        <button type="button" className={`metric-card metric-ok ${filter === 'ok' ? 'active' : ''}`} onClick={() => setFilter('ok')}>
          <span>מלאי תקין (&gt;5)</span>
          <strong>{okCount}</strong>
        </button>
      </div>

      <div className="admin-filters inventory-filters">
        <label>
          חיפוש לפי שם מוצר או מק״ט
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="הקלד שם מוצר..." />
        </label>
        <label>
          סינון לפי מצב מלאי
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">כל המוצרים ({totalCount})</option>
            <option value="low">מלאי נמוך בלבד ({lowCount})</option>
            <option value="out">אזל מהמלאי ({outCount})</option>
            <option value="ok">מלאי תקין ({okCount})</option>
          </select>
        </label>
        <label>
          מיון
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="stock-asc">כמות: נמוך לגבוה (דחוף לטיפול)</option>
            <option value="stock-desc">כמות: גבוה לנמוך</option>
            <option value="name">שם מוצר (א-ת)</option>
            <option value="price-asc">מחיר: נמוך לגבוה</option>
            <option value="price-desc">מחיר: גבוה לנמוך</option>
          </select>
        </label>
      </div>

      {notice ? <p className="profile-note">{notice}</p> : null}
      {error ? <p className="form-errors">{error}</p> : null}

      <p className="admin-count">
        {loading ? 'טוען פריטי מלאי...' : `מציג ${visible.length} מתוך ${products.length} פריטים`}
        {query || filter !== 'all' ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            איפוס סינון
          </button>
        ) : null}
      </p>

      <div className="inventory-list">
        {visible.map((product) => {
          const staged = stagedStock[product.id] ?? product.stock
          const isChanged = staged !== product.stock
          const isLow = product.stock > 0 && product.stock <= 5
          const isOut = product.stock <= 0

          return (
            <article className={`inventory-row ${isOut ? 'row-out' : isLow ? 'row-low' : ''}`} key={product.id}>
              <img src={product.image || `/products/${product.id}.png`} alt="" loading="lazy" decoding="async" />

              <div className="inventory-info">
                <strong>{product.name}</strong>
                <div className="inventory-tags">
                  <span className="badge category-badge">{categoryNames.get(product.category) || product.category}</span>
                  <span className="badge price-badge">{money(product.price)}</span>
                  <span className={`badge stock-badge ${isOut ? 'out' : isLow ? 'low' : 'ok'}`}>
                    {isOut ? 'אזל מהמלאי' : isLow ? `מלאי נמוך: ${product.stock}` : `במלאי: ${product.stock}`}
                  </span>
                </div>
              </div>

              <div className="stock-editor">
                <span className="stock-editor-label">כמות נוכחית:</span>
                <div className="stock-stepper">
                  <button type="button" className="step-btn" onClick={() => updateStaged(product.id, -1)} disabled={staged <= 0}>
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    className="stock-input"
                    value={staged}
                    onChange={(e) => setStagedValue(product.id, parseInt(e.target.value, 10) || 0)}
                  />
                  <button type="button" className="step-btn" onClick={() => updateStaged(product.id, 1)}>
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className={`btn ${isChanged ? 'btn-save-stock' : 'secondary'}`}
                  disabled={savingId === product.id || !isChanged}
                  onClick={() => void saveStock(product)}
                >
                  {savingId === product.id ? 'שומר...' : isChanged ? 'עדכן מלאי ✓' : 'מעודכן'}
                </button>
              </div>

              <div className="inventory-actions">
                <Link className="btn secondary" to={`/products/${product.id}`}>
                  עריכה
                </Link>
                <button type="button" className="text-btn danger-text" onClick={() => void remove(product)}>
                  מחיקה
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {!loading && visible.length === 0 ? <p className="empty">לא נמצאו פריטים התואמים לחיפוש או לסינון.</p> : null}
    </div>
  )
}
