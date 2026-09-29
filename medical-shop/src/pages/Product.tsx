import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { productImage } from '../data'
import { ProductCard } from '../components/ProductCard'
import { EmptyState, QtyControl, Stars, useTitle } from '../components/ui'
import { money } from '../pricing'
import { useStore } from '../store'

export function ProductPage() {
  const { id = '' } = useParams()
  const { addToCart, products, categories, ready } = useStore()
  const product = products.find((item) => item.id === id)
  useTitle(product?.name ?? 'מוצר')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setQty(1)
  }, [id])

  if (!ready) return null
  if (!product) {
    return <EmptyState title="המוצר לא נמצא" text="הפריט אינו בקטלוג." action={<Link className="btn" to="/catalog">חזרה לקטלוג</Link>} />
  }

  const category = categories.find((item) => item.id === product.category)
  const similar = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
  const soldOut = product.stock <= 0

  return (
    <div>
      <p className="crumb">
        <Link to="/catalog">קטלוג</Link>
        {category ? <Link to={`/catalog?cat=${category.id}`}>{category.name}</Link> : null}
      </p>
      <div className="product-layout">
        <div className="gallery-main">
          <img src={productImage(product)} alt={product.name} />
        </div>
        <div className="product-copy">
          <h1>{product.name}</h1>
          <Stars rating={product.rating} reviews={product.reviews} />
          <p>{product.description}</p>
          <div className="price-row big">
            <span className={product.compareAt ? 'price-now discounted' : 'price-now'}>{money(product.price)}</span>
            {product.compareAt ? <span className="compare">{money(product.compareAt)}</span> : null}
          </div>
          <p className="stock">{soldOut ? 'אזל במלאי הדמו' : `נותרו ${product.stock} במלאי הדמו`}</p>
          {soldOut ? null : <QtyControl qty={qty} max={product.stock} onChange={setQty} />}
          <button type="button" className="btn" disabled={soldOut} onClick={() => addToCart(product.id, qty)}>
            {soldOut ? 'אזל במלאי הדמו' : 'הוספה לסל'}
          </button>
          <h2>מפרט</h2>
          <ul className="specs">
            {product.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </div>
      </div>
      {similar.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>מוצרים דומים</h2>
          </div>
          <div className="product-grid">
            {similar.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
