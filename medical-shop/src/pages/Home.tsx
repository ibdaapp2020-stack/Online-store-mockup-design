import { Link } from 'react-router-dom'
import { CATEGORIES, productImage, PRODUCTS } from '../data'
import { ProductCard } from '../components/ProductCard'
import { CategoryIcon } from '../components/Icons'
import { useTitle } from '../components/ui'

export function HomePage() {
  useTitle('בית')
  const featured = PRODUCTS.filter((product) => product.badge === 'popular').slice(0, 4)
  const deals = PRODUCTS.filter((product) => product.compareAt).slice(0, 4)

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">חנות דמו · ללא מרשם</p>
          <h1>מוצרים רפואיים לבית, מוכנים לתצוגה</h1>
          <p className="lede">
            עזרה ראשונה, מדדים, ויטמינים, היגיינה, תמיכות וציוד ביתי. הסל, התשלום והמעקב עובדים מקצה לקצה — בלי שרת ובלי חיוב.
          </p>
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
          <div className="art-card">
            <img src={productImage('thermo')} alt="" />
          </div>
          <div className="art-card">
            <img src={productImage('kit')} alt="" />
          </div>
          <div className="art-card">
            <img src={productImage('vd')} alt="" />
          </div>
        </div>
      </section>

      <section className="trust" aria-label="יתרונות להדגמה">
        <article>
          <h2>משלוח מדומה</h2>
          <p>חינם מעל 199 ₪. מתחת לסכום הזה נוסף דמי משלוח קבועים לתצוגה.</p>
        </article>
        <article>
          <h2>ייעוץ תצוגה</h2>
          <p>הטקסטים בחנות מתארים מוצרים. הם אינם ייעוץ רפואי ואינם הנחיות טיפול.</p>
        </article>
        <article>
          <h2>החזרות דמו</h2>
          <p>מדיניות ההחזרה מוצגת כחלק מהסיפור. אין החזר כספי אמיתי.</p>
        </article>
      </section>

      <section>
        <div className="section-head">
          <h2>קטגוריות</h2>
        </div>
        <div className="cat-grid">
          {CATEGORIES.map((category) => (
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
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
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
