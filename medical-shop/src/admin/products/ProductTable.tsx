import type { Category, Product, ShopSettings } from '../../types'
import { stockState } from '../../types'
import { formatDate, money, moneyExact } from '../../pricing'
import { ProductActions } from './ProductActions'
import { imageSrc } from './storageService'

const STATUS_LABEL = {
  active: 'פעיל',
  inactive: 'לא פעיל',
  draft: 'טיוטה',
  archived: 'ארכיון',
}

const STOCK_LABEL = { in: 'במלאי', low: 'מלאי נמוך', out: 'אזל' }

type Props = {
  products: Product[]
  categories: Category[]
  settings: ShopSettings | null
  selected: string[]
  loading: boolean
  canSeeCost: boolean
  onToggle: (id: string, on: boolean) => void
  onToggleAll: (on: boolean) => void
  onView: (product: Product) => void
  onEdit: (product: Product) => void
  onDuplicate: (product: Product) => void
  onDelete: (product: Product) => void
}

export function ProductTable({
  products,
  categories,
  settings,
  selected,
  loading,
  canSeeCost,
  onToggle,
  onToggleAll,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const names = new Map(categories.map((item) => [item.id, item.name]))
  const threshold = settings?.lowStockThreshold ?? 5
  const allOn = products.length > 0 && products.every((product) => selected.includes(product.id))

  if (loading) {
    return (
      <div className="table-wrap" aria-busy="true">
        <div className="product-skeleton">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="skeleton-row" />
          ))}
        </div>
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="empty panel">
        <h2>אין מוצרים להצגה</h2>
        <p>נסו לנקות את הסינון או להוסיף מוצר חדש.</p>
      </div>
    )
  }

  return (
    <>
      <div className="table-wrap">
        <table className="product-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allOn} onChange={(event) => onToggleAll(event.target.checked)} aria-label="בחירת כל המוצרים בעמוד" />
              </th>
              <th>תמונה</th>
              <th>מוצר</th>
              <th>מק״ט / ברקוד</th>
              <th>קטגוריה</th>
              <th>מחיר</th>
              {canSeeCost ? <th>עלות</th> : null}
              <th>מלאי</th>
              <th>סטטוס</th>
              <th>עודכן</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stock = stockState(product, product.lowStockThreshold ?? threshold)
              const status = product.status || (product.active === false ? 'inactive' : 'active')
              return (
                <tr key={product.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      onChange={(event) => onToggle(product.id, event.target.checked)}
                      aria-label={`בחירת ${product.name}`}
                    />
                  </td>
                  <td>
                    <img
                      src={imageSrc(product.image)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = imageSrc()
                      }}
                    />
                  </td>
                  <td>
                    <strong>{product.name}</strong>
                    <p>{product.shortDescription || product.description}</p>
                  </td>
                  <td>
                    <span>{product.sku || product.id}</span>
                    {product.barcode ? <small>{product.barcode}</small> : null}
                  </td>
                  <td>{names.get(product.category) || product.category}</td>
                  <td>{money(product.price)}</td>
                  {canSeeCost ? <td>{product.costPrice != null ? moneyExact(product.costPrice) : '—'}</td> : null}
                  <td>
                    <span className={`tag stock-${stock}`}>
                      {product.stock} {product.unit || 'יח׳'} · {STOCK_LABEL[stock]}
                    </span>
                  </td>
                  <td>
                    <span className={`tag status-${status}`}>{STATUS_LABEL[status]}</span>
                  </td>
                  <td>{product.updatedAt ? formatDate(product.updatedAt) : '—'}</td>
                  <td>
                    <ProductActions product={product} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="product-cards">
        {products.map((product) => {
          const stock = stockState(product, product.lowStockThreshold ?? threshold)
          const status = product.status || (product.active === false ? 'inactive' : 'active')
          return (
            <article key={product.id} className="product-mini">
              <label className="mini-check">
                <input type="checkbox" checked={selected.includes(product.id)} onChange={(event) => onToggle(product.id, event.target.checked)} />
                <img
                  src={imageSrc(product.image)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = imageSrc()
                  }}
                />
              </label>
              <div>
                <strong>{product.name}</strong>
                <p>
                  {names.get(product.category) || product.category} · {money(product.price)}
                </p>
                <div className="mini-tags">
                  <span className={`tag status-${status}`}>{STATUS_LABEL[status]}</span>
                  <span className={`tag stock-${stock}`}>{STOCK_LABEL[stock]}</span>
                </div>
              </div>
              <ProductActions product={product} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
            </article>
          )
        })}
      </div>
    </>
  )
}
