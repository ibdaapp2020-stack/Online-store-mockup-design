import type { Category } from '../../types'
import type { ProductListQuery } from './productService'

type Props = {
  query: ProductListQuery
  categories: Category[]
  brands: string[]
  total: number
  onChange: (patch: Partial<ProductListQuery>) => void
  onClear: () => void
}

export function ProductFilters({ query, categories, brands, total, onChange, onClear }: Props) {
  const filtering = Boolean(
    query.q || query.sku || query.barcode || (query.category && query.category !== 'all') || (query.brand && query.brand !== 'all') || (query.status && query.status !== 'all') || (query.stock && query.stock !== 'all'),
  )

  return (
    <div className="product-toolbar">
      <div className="product-filters">
        <label>
          שם מוצר
          <input value={query.q ?? ''} onChange={(event) => onChange({ q: event.target.value, page: 1 })} placeholder="חיפוש לפי שם" />
        </label>
        <label>
          מק״ט
          <input value={query.sku ?? ''} onChange={(event) => onChange({ sku: event.target.value, page: 1 })} placeholder="SKU" />
        </label>
        <label>
          ברקוד
          <input value={query.barcode ?? ''} onChange={(event) => onChange({ barcode: event.target.value, page: 1 })} placeholder="ברקוד" />
        </label>
        <label>
          קטגוריה
          <select value={query.category ?? 'all'} onChange={(event) => onChange({ category: event.target.value, page: 1 })}>
            <option value="all">כל הקטגוריות</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {brands.length ? (
          <label>
            מותג
            <select value={query.brand ?? 'all'} onChange={(event) => onChange({ brand: event.target.value, page: 1 })}>
              <option value="all">כל המותגים</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          סטטוס
          <select value={query.status ?? 'all'} onChange={(event) => onChange({ status: event.target.value, page: 1 })}>
            <option value="all">הכל</option>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
            <option value="draft">טיוטה</option>
            <option value="archived">ארכיון</option>
          </select>
        </label>
        <label>
          מלאי
          <select value={query.stock ?? 'all'} onChange={(event) => onChange({ stock: event.target.value, page: 1 })}>
            <option value="all">הכל</option>
            <option value="in">במלאי</option>
            <option value="low">מלאי נמוך</option>
            <option value="out">אזל</option>
          </select>
        </label>
        <label>
          מיון
          <select value={query.sort ?? 'updated'} onChange={(event) => onChange({ sort: event.target.value, page: 1 })}>
            <option value="updated">עדכון אחרון</option>
            <option value="name">שם</option>
            <option value="price">מחיר</option>
            <option value="stock">מלאי</option>
          </select>
        </label>
      </div>
      <div className="filter-meta">
        <p>נמצאו {total} מוצרים</p>
        {filtering ? (
          <button type="button" className="text-btn" onClick={onClear}>
            נקה סינון
          </button>
        ) : null}
      </div>
    </div>
  )
}
