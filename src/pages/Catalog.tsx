import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { EmptyState, SkeletonGrid, useTitle } from '../components/ui'
import { useStore } from '../store'
import type { CategoryId } from '../types'

const SORTS = [
  { id: '', label: 'ברירת מחדל' },
  { id: 'price-asc', label: 'מחיר: נמוך לגבוה' },
  { id: 'price-desc', label: 'מחיר: גבוה לנמוך' },
  { id: 'name', label: 'שם' },
  { id: 'rating', label: 'דירוג' },
]

export function CatalogPage() {
  useTitle('קטלוג')
  const { products, categories, ready } = useStore()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const cat = params.get('cat') ?? ''
  const sort = params.get('sort') ?? ''
  const q = params.get('q') ?? ''
  const min = params.get('min') ?? ''
  const max = params.get('max') ?? ''
  const stock = params.get('stock') === '1'
  const sale = params.get('sale') === '1'
  const badge = params.get('badge') ?? ''
  const rating = Number(params.get('rating') || 0)
  const size = params.get('size') ?? ''
  const color = params.get('color') ?? ''
  const category = categories.find((item) => item.id === cat)
  const sizes = [...new Set(products.flatMap((product) => product.sizes ?? []))].sort()
  const colors = [...new Set(products.flatMap((product) => product.colors ?? []))]

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  function clearFilters() {
    setParams(new URLSearchParams())
  }

  const filtered = products.filter((product) => {
    const inCategory = !cat || product.category === (cat as CategoryId)
    const haystack = `${product.name} ${product.description} ${(product.specs ?? []).join(' ')}`.toLowerCase()
    const inSearch = !q.trim() || haystack.includes(q.trim().toLowerCase())
    const minPrice = min === '' ? 0 : Number(min)
    const maxPrice = max === '' ? Number.POSITIVE_INFINITY : Number(max)
    const inPrice = product.price >= minPrice && product.price <= maxPrice
    const inStock = !stock || product.stock > 0
    const onSale = !sale || Boolean(product.compareAt && product.compareAt > product.price) || product.badge === 'sale'
    const inBadge = !badge || product.badge === badge
    const inRating = !rating || product.rating >= rating
    const inSize = !size || (product.sizes ?? []).includes(size)
    const inColor = !color || (product.colors ?? []).includes(color)
    return inCategory && inSearch && inPrice && inStock && onSale && inBadge && inRating && inSize && inColor
  })

  const visible = [...filtered].sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price
    if (sort === 'price-desc') return b.price - a.price
    if (sort === 'name') return a.name.localeCompare(b.name, 'he')
    if (sort === 'rating') return b.rating - a.rating
    return 0
  })

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>{category ? category.name : 'הקטלוג'}</h1>
          <p className="lede catalog-lede">{category ? category.blurb : 'כל מוצרי המדף להדגמה, בלי מרשם.'}</p>
        </div>
        <button type="button" className="filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
          סינון
        </button>
      </div>
      <div className="catalog-layout">
        <aside className={filtersOpen ? 'filters open' : 'filters'}>
          <label>
            חיפוש בקטלוג
            <input value={q} onChange={(event) => setParam('q', event.target.value)} placeholder="שם, תיאור או מפרט" />
          </label>
          <div className="chip-list">
            <button type="button" className={!cat ? 'chip on' : 'chip'} onClick={() => setParam('cat', '')}>
              הכל
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cat === item.id ? 'chip on' : 'chip'}
                onClick={() => setParam('cat', item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="split-fields">
            <label>
              מחיר מ־
              <input value={min} inputMode="numeric" placeholder="לא חובה" onChange={(event) => setParam('min', event.target.value)} />
            </label>
            <label>
              עד
              <input value={max} inputMode="numeric" placeholder="לא חובה" onChange={(event) => setParam('max', event.target.value)} />
            </label>
          </div>
          <label className="check-line">
            <input type="checkbox" checked={stock} onChange={(event) => setParam('stock', event.target.checked ? '1' : '')} />
            במלאי בלבד
          </label>
          <label className="check-line">
            <input type="checkbox" checked={sale} onChange={(event) => setParam('sale', event.target.checked ? '1' : '')} />
            מבצעים בלבד
          </label>
          <label>
            תווית
            <select value={badge} onChange={(event) => setParam('badge', event.target.value)}>
              <option value="">הכל</option>
              <option value="popular">נמכר</option>
              <option value="sale">מבצע</option>
              <option value="new">חדש</option>
            </select>
          </label>
          <label>
            דירוג מינימלי
            <select value={rating ? String(rating) : ''} onChange={(event) => setParam('rating', event.target.value)}>
              <option value="">הכל</option>
              <option value="3">3 ומעלה</option>
              <option value="4">4 ומעלה</option>
              <option value="4.5">4.5 ומעלה</option>
            </select>
          </label>
          {sizes.length ? (
            <label>
              מידה
              <select value={size} onChange={(event) => setParam('size', event.target.value)}>
                <option value="">הכל</option>
                {sizes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {colors.length ? (
            <label>
              צבע
              <select value={color} onChange={(event) => setParam('color', event.target.value)}>
                <option value="">הכל</option>
                {colors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            מיון
            <select value={sort} onChange={(event) => setParam('sort', event.target.value)}>
              {SORTS.map((option) => (
                <option key={option.id || 'default'} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="text-btn" onClick={clearFilters}>
            ניקוי הסינון
          </button>
        </aside>
        <div>
          {!ready ? (
            <SkeletonGrid />
          ) : visible.length === 0 ? (
            <EmptyState
              title="לא נמצאו מוצרים"
              text={q ? `אין תוצאות עבור «${q}».` : 'אין מוצרים בקטגוריה הזו.'}
              action={
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.delete('q')
                    next.delete('cat')
                    next.delete('min')
                    next.delete('max')
                    next.delete('stock')
                    next.delete('sale')
                    next.delete('badge')
                    next.delete('rating')
                    next.delete('size')
                    next.delete('color')
                    setParams(next)
                  }}
                >
                  ניקוי הסינון
                </button>
              }
            />
          ) : (
            <>
              <p className="result-count">{visible.length} מוצרים</p>
              <div className="product-grid">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
