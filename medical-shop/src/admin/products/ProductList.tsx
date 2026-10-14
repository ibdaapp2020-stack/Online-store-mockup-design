import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { snapshotAdminCatalog } from '../../catalog-sync'
import { useStore } from '../../store'
import type { Category, Product, ShopSettings } from '../../types'
import { ProductDrawer } from './ProductForm'
import { ProductFilters } from './ProductFilters'
import { ProductStats } from './ProductStats'
import { ProductTable } from './ProductTable'
import {
  bulkProducts,
  deleteProduct,
  duplicateProduct,
  exportUrl,
  getCategories,
  getSettings,
  importProducts,
  listProducts,
  type ProductListQuery,
  type ProductStats as Stats,
} from './productService'

const EMPTY_QUERY: ProductListQuery = { page: 1, pageSize: 20, sort: 'updated' }

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitCsv(lines[0])
  return lines.slice(1).map((line) => {
    const values = splitCsv(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function splitCsv(line: string) {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      out.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  out.push(current.trim())
  return out
}

export function ProductList() {
  const { refreshCatalog } = useStore()
  const [query, setQuery] = useState<ProductListQuery>(EMPTY_QUERY)
  const [debounced, setDebounced] = useState<ProductListQuery>(EMPTY_QUERY)
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [brands, setBrands] = useState<string[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [importPreview, setImportPreview] = useState<Record<string, string>[] | null>(null)
  const [importReport, setImportReport] = useState('')
  const [drawer, setDrawer] = useState<{ id?: string; mode: 'edit' | 'view' | 'create' } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listProducts(debounced)
      setItems(data.items)
      setTotal(data.total)
      setBrands(data.brands)
      setStats(data.stats)
      setSelected((current) => current.filter((id) => data.items.some((item) => item.id === id)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את המוצרים')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debounced])

  useEffect(() => {
    void getCategories().then(setCategories).catch(() => setCategories([]))
    void getSettings().then(setSettings).catch(() => setSettings(null))
  }, [])

  const pages = Math.max(1, Math.ceil(total / (debounced.pageSize || 20)))

  async function afterChange() {
    await snapshotAdminCatalog()
    await refreshCatalog()
    await load()
  }

  async function remove(product: Product) {
    const used = product.usedInOrders
    const ok = window.confirm(used ? 'המוצר משויך להזמנות. הוא יועבר לארכיון ולא יימחק.' : `למחוק את ${product.name}?`)
    if (!ok) return
    try {
      const result = await deleteProduct(product.id)
      setNotice(result.archived ? 'המוצר הועבר לארכיון כדי לשמור על הזמנות' : 'המוצר נמחק')
      await afterChange()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'מחיקה נכשלה')
    }
  }

  async function duplicate(product: Product) {
    try {
      const copy = await duplicateProduct(product.id)
      setNotice('המוצר שוכפל עם מק״ט חדש')
      await afterChange()
      setDrawer({ id: copy.id, mode: 'edit' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שכפול נכשל')
    }
  }

  async function runBulk(action: 'activate' | 'deactivate' | 'archive') {
    if (!selected.length) return
    await bulkProducts(selected, action)
    setNotice(action === 'activate' ? 'המוצרים הופעלו' : action === 'deactivate' ? 'המוצרים הושבתו' : 'המוצרים הועברו לארכיון')
    setSelected([])
    await afterChange()
  }

  const importErrors = useMemo(() => {
    if (!importPreview) return []
    return importPreview.flatMap((row, index) => {
      if (!row.name || !row.category || row.price === '' || row.stock === '') return [`שורה ${index + 1}: חסרים שם, קטגוריה, מחיר או מלאי`]
      return []
    })
  }, [importPreview])

  return (
    <div className="products-admin">
      <div className="section-head">
        <div>
          <h1>מוצרים</h1>
          <p className="muted">ניהול מק״ט, מלאי, מחירים ותמונות מול מאגר החנות.</p>
        </div>
        <div className="head-actions">
          <a className="btn secondary" href={exportUrl(debounced)}>
            ייצוא CSV
          </a>
          <label className="btn secondary file-btn">
            ייבוא CSV
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file.text().then((text) => setImportPreview(parseCsv(text)))
                event.target.value = ''
              }}
            />
          </label>
          <button type="button" className="btn" onClick={() => setDrawer({ mode: 'create' })}>
            מוצר חדש
          </button>
        </div>
      </div>
      <ProductStats stats={stats} />
      <ProductFilters
        query={query}
        categories={categories}
        brands={brands}
        total={total}
        onChange={(patch) => setQuery((current) => ({ ...current, ...patch }))}
        onClear={() => setQuery(EMPTY_QUERY)}
      />
      {selected.length ? (
        <div className="bulk-bar">
          <span>נבחרו {selected.length}</span>
          <button type="button" onClick={() => void runBulk('activate')}>
            הפעלה
          </button>
          <button type="button" onClick={() => void runBulk('deactivate')}>
            השבתה
          </button>
          <button type="button" onClick={() => void runBulk('archive')}>
            ארכיון
          </button>
        </div>
      ) : null}
      {error ? <p className="form-errors">{error}</p> : null}
      {notice ? <p className="form-ok">{notice}</p> : null}
      <ProductTable
        products={items}
        categories={categories}
        settings={settings}
        selected={selected}
        loading={loading}
        canSeeCost
        onToggle={(id, on) => setSelected((current) => (on ? [...current, id] : current.filter((item) => item !== id)))}
        onToggleAll={(on) => setSelected(on ? items.map((item) => item.id) : [])}
        onView={(product) => setDrawer({ id: product.id, mode: 'view' })}
        onEdit={(product) => setDrawer({ id: product.id, mode: 'edit' })}
        onDuplicate={duplicate}
        onDelete={remove}
      />
      <div className="pager">
        <label>
          בעמוד
          <select
            value={query.pageSize || 20}
            onChange={(event) => setQuery((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button type="button" disabled={(query.page || 1) <= 1} onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>
          הקודם
        </button>
        <span>
          עמוד {query.page || 1} מתוך {pages}
        </span>
        <button type="button" disabled={(query.page || 1) >= pages} onClick={() => setQuery((current) => ({ ...current, page: (current.page || 1) + 1 }))}>
          הבא
        </button>
      </div>
      {importPreview ? (
        <div className="panel import-box">
          <h2>תצוגה מקדימה לייבוא</h2>
          <p>נמצאו {importPreview.length} שורות.</p>
          {importErrors.length ? (
            <ul className="form-errors">
              {importErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => setImportPreview(null)}>
              ביטול
            </button>
            <button
              type="button"
              className="btn"
              disabled={Boolean(importErrors.length)}
              onClick={() => {
                void importProducts(importPreview).then((result) => {
                  setImportReport(`נוצרו ${result.created}, עודכנו ${result.updated}, שגיאות ${result.errors.length}`)
                  setImportPreview(null)
                  void afterChange()
                })
              }}
            >
              אישור ייבוא
            </button>
          </div>
          {importReport ? <p>{importReport}</p> : null}
        </div>
      ) : null}
      {drawer ? (
        <ProductDrawer
          id={drawer.id}
          mode={drawer.mode}
          onClose={() => {
            setDrawer(null)
            void load()
          }}
        />
      ) : null}
      <p className="muted">
        <Link to="/admin/categories">ניהול קטגוריות</Link> משתמש באותו מקור נתונים כמו החנות.
      </p>
    </div>
  )
}
