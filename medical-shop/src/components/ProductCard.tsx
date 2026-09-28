import { Link } from 'react-router-dom'
import { productImage } from '../data'
import { money } from '../pricing'
import type { Product } from '../types'
import { useStore } from '../store'
import { BadgeTag, Stars } from './ui'

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useStore()
  const soldOut = product.stock <= 0
  return (
    <article className="card">
      <Link to={`/p/${product.id}`} className="card-media">
        <BadgeTag badge={product.badge} />
        <img src={productImage(product.id)} alt="" />
      </Link>
      <div className="card-body">
        <Link to={`/p/${product.id}`} className="card-title">
          {product.name}
        </Link>
        <Stars rating={product.rating} />
        <div className="price-row">
          <span className={product.compareAt ? 'price-now discounted' : 'price-now'}>{money(product.price)}</span>
          {product.compareAt ? <span className="compare">{money(product.compareAt)}</span> : null}
        </div>
        <button type="button" className="btn full" disabled={soldOut} onClick={() => addToCart(product.id)}>
          {soldOut ? 'אזל במלאי הדמו' : 'הוספה לסל'}
        </button>
      </div>
    </article>
  )
}
