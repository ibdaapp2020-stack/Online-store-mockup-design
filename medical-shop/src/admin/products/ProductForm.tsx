import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Category, Product, ProductStatus, ShopSettings } from '../../types'
import { snapshotAdminCatalog } from '../../catalog-sync'
import { useStore } from '../../store'
import { ProductImages } from './ProductImages'
import { ProductInventory } from './ProductInventory'
import { ProductPricing } from './ProductPricing'
import { getCategories, getProduct, getSettings, saveProduct } from './productService'
import { ICONS, Icon } from './icons'

const TABS = [
  ['general', 'פרטים כלליים'],
  ['images', 'תמונות'],
  ['prices', 'מחירים'],
  ['stock', 'מלאי'],
  ['seo', 'SEO'],
  ['options', 'וריאציות'],
] as const

type Tab = (typeof TABS)[number][0]

const EMPTY = {
  name: '',
  sku: '',
  barcode: '',
  brand: '',
  category: '',
  subcategory: '',
  shortDescription: '',
  description: '',
  specs: '',
  status: 'active' as ProductStatus,
  price: '',
  costPrice: '',
  salePrice: '',
  saleStart: '',
  saleEnd: '',
  compareAt: '',
  stock: '',
  lowStockThreshold: '',
  trackInventory: true,
  allowBackorder: false,
  unit: 'יח׳',
  seoTitle: '',
  seoDescription: '',
  slug: '',
  badge: '',
  rating: '4.5',
  reviews: '0',
  sizes: '',
  colors: '',
  others: '',
  otherLabel: 'אחר',
  chooseSize: false,
  chooseColor: false,
  chooseOther: false,
  variantStocks: {} as Record<string, string>,
  images: [] as string[],
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
  if ((form.chooseSize && !sizes.length) || (form.chooseColor && !colors.length) || (form.chooseOther && !others.length)) return []
  const rows: Array<{ size: string; color: string; other: string }> = []
  for (const size of form.chooseSize ? sizes : ['']) {
    for (const color of form.chooseColor ? colors : ['']) {
      for (const other of form.chooseOther ? others : ['']) rows.push({ size, color, other })
    }
  }
  return rows
}

function fromProduct(product: Product): typeof EMPTY {
  return {
    name: product.name,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    brand: product.brand ?? '',
    category: product.category,
    subcategory: product.subcategory ?? '',
    shortDescription: product.shortDescription ?? '',
    description: product.description,
    specs: (product.specs ?? []).join('\n'),
    status: product.status || (product.active === false ? 'inactive' : 'active'),
    price: String(product.price),
    costPrice: product.costPrice != null ? String(product.costPrice) : '',
    salePrice: product.salePrice != null ? String(product.salePrice) : '',
    saleStart: product.saleStart?.slice(0, 10) ?? '',
    saleEnd: product.saleEnd?.slice(0, 10) ?? '',
    compareAt: product.compareAt != null ? String(product.compareAt) : '',
    stock: String(product.stock),
    lowStockThreshold: product.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
    trackInventory: product.trackInventory !== false,
    allowBackorder: Boolean(product.allowBackorder),
    unit: product.unit || 'יח׳',
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    slug: product.slug ?? product.id,
    badge: product.badge ?? '',
    rating: String(product.rating ?? 4.5),
    reviews: String(product.reviews ?? 0),
    sizes: (product.sizes ?? []).join(', '),
    colors: (product.colors ?? []).join(', '),
    others: (product.choices?.others ?? []).join(', '),
    otherLabel: product.choices?.otherLabel || 'אחר',
    chooseSize: Boolean(product.choices?.size || product.sizes?.length),
    chooseColor: Boolean(product.choices?.color || product.colors?.length),
    chooseOther: Boolean(product.choices?.other),
    variantStocks: Object.fromEntries((product.variants ?? []).map((row) => [comboKey(row), String(row.stock)])),
    images: product.images?.length ? product.images : product.image ? [product.image] : [],
  }
}

type Props = {
  id?: string
  mode?: 'edit' | 'view' | 'create'
  onClose?: () => void
}

export function ProductForm({ id, mode = 'edit', onClose }: Props) {
  const navigate = useNavigate()
  const { refreshCatalog } = useStore()
  const [form, setForm] = useState(EMPTY)
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY))
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [history, setHistory] = useState<Product['history']>([])
  const [tab, setTab] = useState<Tab>('general')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const readOnly = mode === 'view'

  useEffect(() => {
    void getCategories()
      .then((rows) => {
        setCategories(rows)
        setForm((current) => (id || current.category ? current : { ...current, category: rows[0]?.id || '' }))
      })
      .catch(() => setCategories([]))
    void getSettings().then(setSettings).catch(() => setSettings(null))
  }, [id])

  useEffect(() => {
    if (!id) {
      setForm(EMPTY)
      setBaseline(JSON.stringify(EMPTY))
      setLoading(false)
      return
    }
    setLoading(true)
    void getProduct(id)
      .then((product) => {
        const next = fromProduct(product)
        setForm(next)
        setBaseline(JSON.stringify(next))
        setHistory(product.history ?? [])
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את המוצר'))
      .finally(() => setLoading(false))
  }, [id])

  const dirty = JSON.stringify(form) !== baseline

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function persist(status = form.status) {
    if (saving) return
    setSaving(true)
    setError('')
    setNotice('')
    const body = new FormData()
    const payload = { ...form, status }
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'variantStocks' || key === 'images') return
      body.append(key, String(value))
    })
    body.append('images', JSON.stringify(form.images))
    body.append('image', form.images[0] || '')
    body.append(
      'choices',
      JSON.stringify({
        size: form.chooseSize,
        color: form.chooseColor,
        other: form.chooseOther,
        otherLabel: form.otherLabel,
        others: listValues(form.others),
      }),
    )
    body.append(
      'variants',
      JSON.stringify(optionCombos(form).map((row) => ({ ...row, stock: Number(form.variantStocks[comboKey(row)] || 0) }))),
    )
    try {
      const saved = await saveProduct(id, body)
      await snapshotAdminCatalog()
      await refreshCatalog()
      setNotice('המוצר נשמר בהצלחה')
      setBaseline(JSON.stringify({ ...form, status }))
      if (!id) navigate(`/admin/products/${saved.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void persist(form.status === 'draft' ? 'active' : form.status)
  }

  function close() {
    if (dirty && !window.confirm('יש שינויים שלא נשמרו. לצאת בלי שמירה?')) return
    if (onClose) onClose()
    else navigate('/admin/products')
  }

  const combos = useMemo(() => optionCombos(form), [form])
  const previewTitle = form.seoTitle || form.name || 'כותרת המוצר'
  const previewSlug = form.slug || 'product-slug'

  if (loading) return <p className="admin-wait">טוען מוצר...</p>

  return (
    <form className="product-form" onSubmit={onSubmit}>
      <header className="drawer-head">
        <div>
          <h1>{id ? (readOnly ? 'צפייה במוצר' : 'עריכת מוצר') : 'מוצר חדש'}</h1>
          <p className="muted">שם וקטגוריה ומחיר ומלאי הם שדות חובה. מק״ט חייב להיות ייחודי.</p>
        </div>
        <button type="button" className="icon-btn" onClick={close} aria-label="סגירה">
          <Icon path={ICONS.close} label="סגירה" />
        </button>
      </header>
      <div className="form-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'tab on' : 'tab'} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'general' ? (
        <section className="form-block">
          <label>
            שם מוצר
            <input value={form.name} required disabled={readOnly} onChange={(event) => set('name', event.target.value)} />
          </label>
          <div className="split-fields">
            <label>
              מק״ט
              <input value={form.sku} disabled={readOnly} onChange={(event) => set('sku', event.target.value)} />
            </label>
            <label>
              ברקוד
              <input value={form.barcode} disabled={readOnly} onChange={(event) => set('barcode', event.target.value)} />
            </label>
          </div>
          <div className="split-fields">
            <label>
              מותג
              <input value={form.brand} disabled={readOnly} onChange={(event) => set('brand', event.target.value)} />
            </label>
            <label>
              קטגוריה
              <select value={form.category} required disabled={readOnly} onChange={(event) => set('category', event.target.value)}>
                <option value="">בחרו קטגוריה</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            תת־קטגוריה
            <input value={form.subcategory} disabled={readOnly} onChange={(event) => set('subcategory', event.target.value)} />
          </label>
          <label>
            תיאור קצר
            <input value={form.shortDescription} disabled={readOnly} onChange={(event) => set('shortDescription', event.target.value)} />
          </label>
          <label>
            תיאור מלא
            <textarea value={form.description} disabled={readOnly} rows={4} onChange={(event) => set('description', event.target.value)} />
          </label>
          <label>
            מפרט, שורה לכל פריט
            <textarea value={form.specs} disabled={readOnly} rows={4} onChange={(event) => set('specs', event.target.value)} />
          </label>
          <div className="split-fields">
            <label>
              סטטוס
              <select value={form.status} disabled={readOnly} onChange={(event) => set('status', event.target.value as ProductStatus)}>
                <option value="active">פעיל</option>
                <option value="inactive">לא פעיל</option>
                <option value="draft">טיוטה</option>
                <option value="archived">ארכיון</option>
              </select>
            </label>
            <label>
              תג
              <select value={form.badge} disabled={readOnly} onChange={(event) => set('badge', event.target.value)}>
                <option value="">בלי תג</option>
                <option value="new">חדש</option>
                <option value="sale">מבצע</option>
                <option value="popular">נמכר</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}
      {tab === 'images' ? <ProductImages images={form.images} disabled={readOnly} onChange={(images) => set('images', images)} /> : null}
      {tab === 'prices' ? (
        <ProductPricing form={form} settings={settings} canSeeCost disabled={readOnly} onChange={(key, value) => set(key, value)} />
      ) : null}
      {tab === 'stock' ? (
        <ProductInventory
          form={form}
          settings={settings}
          history={history}
          disabled={readOnly}
          onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        />
      ) : null}
      {tab === 'seo' ? (
        <section className="form-block">
          <label>
            כותרת SEO
            <input value={form.seoTitle} disabled={readOnly} onChange={(event) => set('seoTitle', event.target.value)} />
          </label>
          <label>
            תיאור SEO
            <textarea value={form.seoDescription} disabled={readOnly} rows={3} onChange={(event) => set('seoDescription', event.target.value)} />
          </label>
          <label>
            כתובת Slug
            <input value={form.slug} disabled={readOnly} onChange={(event) => set('slug', event.target.value)} />
          </label>
          <div className="seo-preview">
            <small>תצוגה מקדימה</small>
            <strong>{previewTitle}</strong>
            <p>propharm.local/p/{previewSlug}</p>
            <span>{form.seoDescription || form.shortDescription || form.description}</span>
          </div>
        </section>
      ) : null}
      {tab === 'options' ? (
        <section className="form-block">
          <div className="choice-row">
            <label className="check">
              <input type="checkbox" checked={form.chooseSize} disabled={readOnly} onChange={(event) => set('chooseSize', event.target.checked)} />
              מידה
            </label>
            <label className="check">
              <input type="checkbox" checked={form.chooseColor} disabled={readOnly} onChange={(event) => set('chooseColor', event.target.checked)} />
              צבע
            </label>
            <label className="check">
              <input type="checkbox" checked={form.chooseOther} disabled={readOnly} onChange={(event) => set('chooseOther', event.target.checked)} />
              אפשרות נוספת
            </label>
          </div>
          {form.chooseSize ? (
            <label>
              מידות
              <input value={form.sizes} disabled={readOnly} onChange={(event) => set('sizes', event.target.value)} />
            </label>
          ) : null}
          {form.chooseColor ? (
            <label>
              צבעים
              <input value={form.colors} disabled={readOnly} onChange={(event) => set('colors', event.target.value)} />
            </label>
          ) : null}
          {form.chooseOther ? (
            <div className="split-fields">
              <label>
                שם האפשרות
                <input value={form.otherLabel} disabled={readOnly} onChange={(event) => set('otherLabel', event.target.value)} />
              </label>
              <label>
                ערכים
                <input value={form.others} disabled={readOnly} onChange={(event) => set('others', event.target.value)} />
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
                    disabled={readOnly}
                    value={form.variantStocks[comboKey(row)] ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, variantStocks: { ...current.variantStocks, [comboKey(row)]: event.target.value } }))}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {history?.filter((item) => item.kind === 'change').length ? (
        <section className="form-block">
          <h2>היסטוריית שינויים</h2>
          {history
            .filter((item) => item.kind === 'change')
            .map((item) => (
              <p key={item.id} className="muted">
                {item.createdAt} · {item.actor} · {item.detail}
              </p>
            ))}
        </section>
      ) : null}
      {error ? <p className="form-errors">{error}</p> : null}
      {notice ? <p className="form-ok">{notice}</p> : null}
      {readOnly ? null : (
        <div className="form-actions">
          <button className="btn secondary" type="button" disabled={saving} onClick={() => void persist('draft')}>
            שמירת טיוטה
          </button>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'שומר...' : id ? 'שמירת שינויים' : 'פרסום מוצר'}
          </button>
        </div>
      )}
    </form>
  )
}

export function ProductFormPage() {
  const { id } = useParams()
  return (
    <div className="panel product-page">
      <ProductForm id={id} mode={id ? 'edit' : 'create'} />
    </div>
  )
}

export function ProductDrawer({
  id,
  mode,
  onClose,
}: {
  id?: string
  mode: 'edit' | 'view' | 'create'
  onClose: () => void
}) {
  return (
    <div className="drawer-root">
      <button type="button" className="drawer-mask" aria-label="סגירה" onClick={onClose} />
      <aside className="product-drawer" role="dialog" aria-modal="true">
        <ProductForm id={id} mode={mode} onClose={onClose} />
      </aside>
    </div>
  )
}
