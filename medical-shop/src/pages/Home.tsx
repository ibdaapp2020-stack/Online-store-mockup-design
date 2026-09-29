import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { SkeletonGrid, useTitle } from '../components/ui'
import { productImage } from '../data'
import { useStore } from '../store'

const COVER: Record<string, string> = {
  'first-aid': 'kit',
  monitors: 'thermo',
  vitamins: 'vd',
  hygiene: 'gel',
  ortho: 'knee-sleeve',
  home: 'walker-std',
}

export function HomePage() {
  useTitle('בית')
  const { products, categories, ready } = useStore()
  const [more, setMore] = useState(false)
  const shelf = [...products.filter((product) => product.badge === 'new'), ...products.filter((product) => product.badge !== 'new')].slice(0, 8)
  const shown = more ? categories : categories.slice(0, 5)
  const kit = products.find((product) => product.id === 'kit')

  function cover(id: string) {
    const product = products.find((item) => item.id === COVER[id]) || products.find((item) => item.category === id)
    if (product) return productImage(product)
    const file = COVER[id]
    return file ? `/products/${file}.jpg` : '/logo.jpg'
  }

  return (
    <div>
      <section className="promo-row" aria-label="מבצעים">
        <Link className="promo" to="/catalog?badge=new">
          <img src="/products/walker-std.jpg" alt="" />
          <span>מוצרים חדשים</span>
        </Link>
        <Link className="promo promo-sale" to="/p/kit">
          <img src={kit ? productImage(kit) : '/products/kit.png'} alt="" />
          <span>מבצע לערכה</span>
        </Link>
      </section>

      <section className="home-cats">
        <div className="section-head">
          <h2>קטגוריות</h2>
        </div>
        <div className="cat-showcase">
          {shown.map((category) => (
            <Link key={category.id} className="cat-tile" to={`/catalog?cat=${category.id}`}>
              <img src={cover(category.id)} alt="" />
              <strong>{category.name}</strong>
            </Link>
          ))}
          {more ? null : (
            <button type="button" className="cat-tile cat-more" onClick={() => setMore(true)}>
              עוד
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>המוצרים</h2>
          <Link to="/catalog">לכל המוצרים</Link>
        </div>
        {ready ? (
          <div className="product-grid">
            {shelf.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <SkeletonGrid />
        )}
      </section>
    </div>
  )
}
