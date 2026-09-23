import { Link } from 'react-router-dom'
import { categoryName, setupById } from '../data'
import { money, unitFor } from '../pricing'
import { useStore } from '../store'
import type { Product } from '../types'
import { Glyph, ProductPhoto, Stars } from './ui'

export function ProductCard({ product }: { product: Product }) {
  const { audience, addToCart, cart, pricesOpen } = useStore()
  if (!audience) return null
  const priced = unitFor(product, audience, 1)
  const inCart = cart.find((line) => line.productId === product.id)?.qty ?? 0
  const setup = setupById(product.setupId)
  const soldOut = product.stock <= 0
  const photo = product.images?.[0]

  return (
    <article className="pcard">
      <Link to={`/p/${product.id}`} className={`art cat-${product.category}`}>
        <ProductPhoto src={photo} alt={product.name} />
        {!photo && <span className="art-brand">{product.brand}</span>}
        {product.badge && <span className="badge">{product.badge}</span>}
        {!photo && <Glyph cat={product.category} />}
      </Link>
      <div className="body">
        <p className="eyebrow">{categoryName(product.category)}</p>
        <h3>
          <Link to={`/p/${product.id}`}>{product.name}</Link>
        </h3>
        <Stars value={product.rating} />
        {setup && <p className="chip">חלק מ{setup.name}</p>}
        {pricesOpen && (
          <div className="price-row">
            <strong className="price">{money(priced.unit)}</strong>
            <span className="muted">{audience === 'business' ? 'לפני מע״מ' : 'כולל מע״מ'}</span>
          </div>
        )}
        {product.stock > 0 && product.stock <= 5 && <p className="low">נותרו {product.stock}</p>}
        {pricesOpen && (
          <button type="button" className="btn btn-dark" disabled={soldOut} onClick={() => addToCart(product.id)}>
            {soldOut ? 'אזל' : inCart > 0 ? `בסל · ${inCart}` : 'הוספה לסל'}
          </button>
        )}
      </div>
    </article>
  )
}
