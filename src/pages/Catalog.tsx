import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { Empty } from '../components/ui'
import { categories, productVisible } from '../data'
import { unitFor } from '../pricing'
import { useStore } from '../store'
import type { Product } from '../types'

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'name'

export function Catalog() {
  const { cat = 'all' } = useParams()
  const [params, setParams] = useSearchParams()
  const query = (params.get('q') ?? '').trim()
  const sub = params.get('sub') ?? ''
  const { audience, products, pricesOpen } = useStore()
  const [sort, setSort] = useState<SortKey>('featured')
  const [brands, setBrands] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [color, setColor] = useState('')
  const [storage, setStorage] = useState('')
  const [stockOnly, setStockOnly] = useState(false)
  const [minRating, setMinRating] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const category = categories.find((item) => item.id === cat)

  const pool = useMemo(
    () =>
      products.filter((product) => {
        if (!product.active || !productVisible(product, audience)) return false
        if (cat !== 'all' && product.category !== cat) return false
        if (!query) return true
        const hay = `${product.name} ${product.brand} ${product.blurb} ${product.story ?? ''}`.toLowerCase()
        return hay.includes(query.toLowerCase())
      }),
    [audience, cat, products, query],
  )

  const brandOptions = [...new Set(pool.map((product) => product.brand))].sort()
  const colorOptions = [...new Set(pool.flatMap((product) => (product.colors ?? []).map((item) => item.name)))]
  const storageOptions = [...new Set(pool.flatMap((product) => (product.storages ?? []).map((item) => item.label)))]

  const items = useMemo(() => {
    const min = Number(minPrice)
    const max = Number(maxPrice)
    const list = pool.filter((product) => {
      if (sub && product.sub !== sub) return false
      if (brands.length && !brands.includes(product.brand)) return false
      if (color && !(product.colors ?? []).some((item) => item.name === color)) return false
      if (storage && !(product.storages ?? []).some((item) => item.label === storage)) return false
      if (stockOnly && product.stock <= 0) return false
      if (minRating && product.rating < minRating) return false
      const price = audience ? unitFor(product, audience, 1).unit : product.price
      if (minPrice !== '' && !Number.isNaN(min) && price < min) return false
      if (maxPrice !== '' && !Number.isNaN(max) && price > max) return false
      return true
    })
    const score = (product: Product) => (product.fit === audience ? 2 : product.fit === 'all' ? 1 : 0)
    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'he')
      if (sort === 'price-asc' || sort === 'price-desc') {
        const av = audience ? unitFor(a, audience, 1).unit : a.price
        const bv = audience ? unitFor(b, audience, 1).unit : b.price
        return sort === 'price-asc' ? av - bv : bv - av
      }
      if (sort === 'rating') return b.rating - a.rating
      const diff = score(b) - score(a)
      return diff !== 0 ? diff : b.reviews - a.reviews
    })
  }, [audience, brands, color, maxPrice, minPrice, minRating, pool, sort, stockOnly, storage, sub])

  const title = query ? `חיפוש: ${query}` : category?.name ?? 'כל המוצרים'
  const toggleBrand = (brand: string) => setBrands((prev) => (prev.includes(brand) ? prev.filter((item) => item !== brand) : [...prev, brand]))

  const filters = (
    <div className="filter-body">
      <label className="checkline">
        <input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} />
        במלאי
      </label>
      <label className="field">
        <span>דירוג</span>
        <select value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}>
          <option value={0}>הכל</option>
          <option value={4}>4 ומעלה</option>
          <option value={4.5}>4.5 ומעלה</option>
        </select>
      </label>
      {pricesOpen && (
        <div className="price-filter">
          <span>מחיר</span>
          <input inputMode="numeric" placeholder="מ־" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <input inputMode="numeric" placeholder="עד" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
      )}
      {brandOptions.length > 1 && (
        <fieldset>
          <legend>מותג</legend>
          {brandOptions.map((brand) => (
            <label key={brand} className="checkline">
              <input type="checkbox" checked={brands.includes(brand)} onChange={() => toggleBrand(brand)} />
              {brand}
            </label>
          ))}
        </fieldset>
      )}
      {colorOptions.length > 0 && (
        <label className="field">
          <span>צבע</span>
          <select value={color} onChange={(event) => setColor(event.target.value)}>
            <option value="">הכל</option>
            {colorOptions.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      {storageOptions.length > 0 && (
        <label className="field">
          <span>אחסון</span>
          <select value={storage} onChange={(event) => setStorage(event.target.value)}>
            <option value="">הכל</option>
            {storageOptions.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="text-btn"
        onClick={() => {
          setBrands([])
          setMinPrice('')
          setMaxPrice('')
          setColor('')
          setStorage('')
          setStockOnly(false)
          setMinRating(0)
          setSort('featured')
          if (sub || query) setParams({})
        }}
      >
        ניקוי סינון
      </button>
    </div>
  )

  return (
    <div className="wrap catalog">
      <div className="sec-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">
            {items.length} פריטים
            {category && !query ? ` · ${category.line}` : ''}
          </p>
        </div>
        <label className="sort">
          מיון
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="featured">מומלצים</option>
            <option value="price-asc">מחיר: מהנמוך</option>
            <option value="price-desc">מחיר: מהגבוה</option>
            <option value="rating">דירוג</option>
            <option value="name">שם</option>
          </select>
        </label>
      </div>
      {cat === 'repair' && (
        <Link className="lab-banner" to="/lab">
          <strong>הצעת מחיר לתיקון</strong>
          <span>מעלים תמונות של המכשיר ומקבלים מחיר לפני הגעה.</span>
        </Link>
      )}
      {category && category.audience === 'business' && audience !== 'business' ? (
        <Empty title="הקטגוריה לעסקים" text="ציוד מחלקות מוצג אחרי כניסה כלקוח עסקי." to="/" action="לכניסה העסקית" />
      ) : (
        <div className="catalog-layout">
          <aside className="filters">
            <button type="button" className="btn btn-ghost filter-toggle" onClick={() => setShowFilters((value) => !value)}>
              סינון
            </button>
            <div className={showFilters ? 'filter-body' : 'filter-body hide-mobile'}>{filters}</div>
          </aside>
          <div>
            {category && (
              <div className="subnav">
                <Link to={`/c/${category.id}`} className={sub ? '' : 'on'}>
                  הכל
                </Link>
                {category.subs.map((item) => (
                  <Link key={item.id} to={`/c/${category.id}?sub=${item.id}`} className={sub === item.id ? 'on' : ''}>
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
            {!category && cat === 'all' && (
              <div className="subnav">
                <Link to="/c/all" className="on">
                  הכל
                </Link>
                {categories
                  .filter((item) => item.audience === 'all' || item.audience === audience)
                  .map((item) => (
                    <Link key={item.id} to={`/c/${item.id}`}>
                      {item.name}
                    </Link>
                  ))}
              </div>
            )}
            {items.length === 0 ? (
              <Empty title="לא מצאנו פריטים" text="נסו מילה אחרת או נקו את הסינון." to="/c/all" action="לכל המוצרים" />
            ) : (
              <div className="grid">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
