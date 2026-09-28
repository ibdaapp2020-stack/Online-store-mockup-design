import { useSearchParams } from 'react-router-dom'
import { CATEGORIES, PRODUCTS } from '../data'
import { ProductCard } from '../components/ProductCard'
import { EmptyState, SkeletonGrid, useMockDelay, useTitle } from '../components/ui'
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
  const ready = useMockDelay(300)
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') ?? ''
  const sort = params.get('sort') ?? ''
  const q = params.get('q') ?? ''
  const category = CATEGORIES.find((item) => item.id === cat)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  const filtered = PRODUCTS.filter((product) => {
    const inCategory = !cat || product.category === (cat as CategoryId)
    const haystack = `${product.name} ${product.description}`.toLowerCase()
    const inSearch = !q.trim() || haystack.includes(q.trim().toLowerCase())
    return inCategory && inSearch
  })

  const products = [...filtered].sort((a, b) => {
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
          <p className="lede">{category ? category.blurb : 'כל מוצרי המדף להדגמה, בלי מרשם.'}</p>
        </div>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <label>
            חיפוש בקטלוג
            <input value={q} onChange={(event) => setParam('q', event.target.value)} placeholder="שם מוצר" />
          </label>
          <div className="chip-list">
            <button type="button" className={!cat ? 'chip on' : 'chip'} onClick={() => setParam('cat', '')}>
              הכל
            </button>
            {CATEGORIES.map((item) => (
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
        </aside>
        <div>
          {!ready ? (
            <SkeletonGrid />
          ) : products.length === 0 ? (
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
                    setParams(next)
                  }}
                >
                  ניקוי הסינון
                </button>
              }
            />
          ) : (
            <>
              <p className="result-count">{products.length} מוצרים</p>
              <div className="product-grid">
                {products.map((product) => (
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
