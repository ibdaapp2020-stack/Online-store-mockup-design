import { Link } from 'react-router-dom'
import { productImage } from '../data'
import { ProductCard } from '../components/ProductCard'
import { CategoryIcon } from '../components/Icons'
import { SkeletonGrid, useTitle } from '../components/ui'
import { PICKUP } from '../pickup'
import { useStore } from '../store'

export function HomePage() {
  useTitle('בית')
  const { products, categories, ready, settings } = useStore()
  const featured = products.filter((product) => product.badge === 'popular').slice(0, 4)
  const deals = products.filter((product) => product.compareAt).slice(0, 4)
  const hero = [products.find((product) => product.id === 'thermo'), products.find((product) => product.id === 'kit'), products.find((product) => product.id === 'vd')].filter(Boolean)

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">{settings.storeName} · ללא מרשם</p>
          <h1>{settings.tagline}</h1>
          <p className="lede">עזרה ראשונה, מדדים, ויטמינים, היגיינה, תמיכות וציוד ביתי. אפשר גם איסוף עצמי מהחנות.</p>
          <div className="hero-actions">
            <Link className="btn" to="/catalog">
              לקטלוג
            </Link>
            <Link className="btn secondary" to="/track">
              מעקב הזמנה
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          {(hero.length ? hero : [{ id: 'thermo' }, { id: 'kit' }, { id: 'vd' }]).map((product) =>
            product ? (
              <div className="art-card" key={product.id}>
                <img src={productImage(product)} alt="" />
              </div>
            ) : null,
          )}
        </div>
      </section>

      <section className="trust" aria-label="שירות">
        <article>
          <h2>איסוף עצמי</h2>
          <p>
            <a href={PICKUP.maps} target="_blank" rel="noreferrer">
              {PICKUP.line}
            </a>
          </p>
        </article>
        <article>
          <h2>משלוח</h2>
          <p>חינם מעל {settings.freeFrom} ₪. מתחת לסכום הזה נוסף דמי משלוח.</p>
        </article>
        <article>
          <h2>מעקב הזמנה</h2>
          <p>אחרי הקנייה אפשר לעקוב אחרי הסטטוס לפי מספר ההזמנה.</p>
        </article>
        <article>
          <h2>בלי מרשם</h2>
          <p>הטקסטים מתארים מוצרים. הם אינם ייעוץ רפואי ואינם הנחיות טיפול.</p>
        </article>
      </section>

      <section>
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
          <h2>נמכרים בתצוגה</h2>
          <Link to="/catalog?sort=rating">לכל המוצרים</Link>
        </div>
        {ready ? (
          <div className="product-grid">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <SkeletonGrid />
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>מבצעים</h2>
          <Link to="/catalog">לקטלוג המלא</Link>
        </div>
        <div className="product-grid">
          {deals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  )
}
