import { useEffect, useState } from 'react'
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
  const newest = products.slice(0, 4)
  const best = [...products.filter((product) => product.badge === 'popular')].sort((a, b) => b.reviews - a.reviews).slice(0, 4)
  const recommended = [...products]
    .filter((product) => !best.some((item) => item.id === product.id))
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, 4)
  const shown = more ? categories : categories.slice(0, 5)
  const kit = products.find((product) => product.id === 'kit')
  const [slide, setSlide] = useState(0)
  const slides = [
    { id: 'new', to: '/catalog?badge=new' },
    { id: 'kit', to: '/p/kit' },
  ]

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  function cover(id: string) {
    const product = products.find((item) => item.id === COVER[id]) || products.find((item) => item.category === id)
    if (product) return productImage(product)
    const file = COVER[id]
    return file ? `/products/${file}.jpg` : '/logo.jpg'
  }

  return (
    <div>
      <section className="hero-slider" aria-label="כניסה">
        <div className="hero-track" style={{ transform: `translateX(${slide * 100}%)` }}>
          <Link className="hero-slide" to={slides[0].to}>
            <div>
              <p className="hero-kicker">PRO PHARM</p>
              <h2>מוצרים חדשים</h2>
              <p>תמיכות, הליכה וציוד ביתי חדש במדף.</p>
              <span className="hero-cta">לכל המוצרים</span>
            </div>
            <img src="/products/walker-std.jpg" alt="" />
          </Link>
          <Link className="hero-slide hero-sale" to={slides[1].to}>
            <div>
              <p className="hero-kicker">מבצע</p>
              <h2>ערכת עזרה ראשונה</h2>
              <p>במחיר מוזל לזמן מוגבל.</p>
              <span className="hero-cta">לערכה</span>
            </div>
            <div className="hero-deal">
              <img src={kit ? productImage(kit) : '/products/kit.png'} alt="" />
              <span className="deal-now">{kit?.price ?? 89} ₪</span>
              <span className="deal-was">{kit?.compareAt ?? 119} ₪</span>
            </div>
          </Link>
        </div>
        <div className="hero-dots">
          {slides.map((item, index) => (
            <button key={item.id} type="button" className={slide === index ? 'on' : ''} aria-label={`שקף ${index + 1}`} onClick={() => setSlide(index)} />
          ))}
        </div>
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
          <h2>נוספו עכשיו</h2>
          <Link to="/catalog">לקטלוג</Link>
        </div>
        {ready ? (
          <div className="product-grid">
            {newest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <SkeletonGrid />
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>הכי נמכר</h2>
          <Link to="/catalog?badge=popular">לכל הנמכרים</Link>
        </div>
        {ready ? (
          <div className="product-grid">
            {best.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <SkeletonGrid />
        )}
      </section>

      <Link className="club-banner" to="/account">
        <img src="/products/sleep-pillow.jpg" alt="" />
        <div>
          <p className="hero-kicker">מועדון לקוחות</p>
          <h2>10% לקנייה הבאה</h2>
          <p>נרשמים לאזור האישי ומקבלים את ההטבה בחשבון.</p>
          <span className="hero-cta">להרשמה</span>
        </div>
      </Link>

      <section>
        <div className="section-head">
          <h2>מוצרים מומלצים</h2>
          <Link to="/catalog?sort=rating">לפי דירוג</Link>
        </div>
        <div className="product-grid">
          {recommended.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  )
}
