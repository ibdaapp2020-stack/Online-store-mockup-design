import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { CategoryIcon } from '../components/Icons'
import { SkeletonGrid, useTitle } from '../components/ui'
import { useStore } from '../store'

export function HomePage() {
  useTitle('בית')
  const { products, categories, ready } = useStore()
  const shelf = [...products.filter((product) => product.badge === 'new'), ...products.filter((product) => product.badge !== 'new')].slice(0, 8)

  return (
    <div>
      <section className="home-cats">
        <div className="section-head">
          <h2>קטגוריות</h2>
        </div>
        <div className="cat-grid">
          {categories.map((category) => (
            <Link key={category.id} className="cat-card" to={`/catalog?cat=${category.id}`}>
              <span className="cat-icon">
                <CategoryIcon id={category.id} />
              </span>
              <strong>{category.name}</strong>
              <span>{category.blurb}</span>
            </Link>
          ))}
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
