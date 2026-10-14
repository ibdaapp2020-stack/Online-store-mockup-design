import { Link } from 'react-router-dom'
import { productImage } from '../data'
import { money } from '../pricing'
import type { Product } from '../types'
import { canPurchase, storePrice } from '../types'
import { useStore } from '../store'
import { BadgeTag, Stars } from './ui'

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, settings } = useStore()
  const priced = storePrice(product)
  const soldOut = !canPurchase(product, settings)
  const needsChoice = Boolean(product.choices?.size || product.choices?.color || product.choices?.other || product.sizes?.length || product.colors?.length)
  return (
    <article className="card">
      <Link to={`/p/${product.id}`} className="card-media">
        <BadgeTag badge={product.badge || (priced.onSale ? 'sale' : undefined)} />
        <img
          src={productImage(product)}
          alt=""
          onError={(event) => {
            event.currentTarget.src = '/products/placeholder.svg'
          }}
        />
      </Link>
      <div className="card-body">
        <Link to={`/p/${product.id}`} className="card-title">
          {product.name}
        </Link>
        <Stars rating={product.rating} />
        <div className="price-row">
          <span className={priced.compareAt ? 'price-now discounted' : 'price-now'}>{money(priced.price)}</span>
          {priced.compareAt ? <span className="compare">{money(priced.compareAt)}</span> : null}
        </div>
        {needsChoice ? (
          <Link className="btn full" to={`/p/${product.id}`}>
            {soldOut ? 'אזל מהמלאי' : 'בחירת מידה / צבע'}
          </Link>
        ) : (
          <button type="button" className="btn full" disabled={soldOut} onClick={() => addToCart(product.id)}>
            {soldOut ? 'אזל מהמלאי' : 'הוספה לסל'}
          </button>
        )}
      </div>
    </article>
  )
}
