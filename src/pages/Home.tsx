import { useEffect, useRef, useState } from 'react'
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
  const { products, categories, ready, error } = useStore()
  const newest = products
  const best = [...products].sort((a, b) => Number(b.badge === 'popular') - Number(a.badge === 'popular') || b.reviews - a.reviews)
  const recommended = [...products]
    .filter((product) => !best.slice(0, 10).some((item) => item.id === product.id))
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
  const [shelfSize, setShelfSize] = useState({ newest: 10, best: 10, recommended: 10 })
  const kit = products.find((product) => product.id === 'kit')
  const catsRef = useRef<HTMLDivElement>(null)
  const [catEnds, setCatEnds] = useState({ prev: false, next: false })
  const [slide, setSlide] = useState(0)
  const slides = [
    { id: 'new', to: '/catalog?badge=new' },
    { id: 'clinic', to: '/account#appointments' },
    { id: 'kit', to: '/p/kit' },
  ]

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  function measureCats() {
    const node = catsRef.current
    if (!node) return
    const box = node.getBoundingClientRect()
    const tiles = [...node.querySelectorAll<HTMLElement>('.cat-tile')]
    const first = tiles[0]?.getBoundingClientRect()
    const last = tiles[tiles.length - 1]?.getBoundingClientRect()
    setCatEnds({
      prev: Boolean(first && first.right > box.right + 8),
      next: Boolean(last && last.left < box.left - 8),
    })
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(measureCats)
    const node = catsRef.current
    if (!node) return () => window.cancelAnimationFrame(frame)
    node.addEventListener('scroll', measureCats, { passive: true })
    window.addEventListener('resize', measureCats)
    return () => {
      window.cancelAnimationFrame(frame)
      node.removeEventListener('scroll', measureCats)
      window.removeEventListener('resize', measureCats)
    }
  }, [categories.length])

  function moveSlide(direction: 'next' | 'prev') {
    setSlide((current) => {
      const count = slides.length
      return direction === 'next' ? (current + 1) % count : (current - 1 + count) % count
    })
  }

  function moveCats(direction: 'next' | 'prev') {
    const node = catsRef.current
    if (!node) return
    const step = Math.max(160, Math.round(node.clientWidth * 0.72))
    node.scrollBy({ left: direction === 'next' ? -step : step, behavior: 'smooth' })
  }

  function cover(id: string) {
    const product = products.find((item) => item.id === COVER[id]) || products.find((item) => item.category === id)
    if (product) return productImage(product)
    const file = COVER[id]
    return file ? `/products/${file}.jpg` : '/logo.jpg'
  }

  return (
    <div>
      <section className="hero-slider" aria-label="כניסה">
        <button type="button" className="cat-arrow hero-arrow cat-prev" aria-label="שקף קודם" onClick={() => moveSlide('prev')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.4 6.4 15 12l-5.6 5.6L8 16.2 12.2 12 8 7.8z" /></svg>
        </button>
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
          <Link className="hero-slide hero-clinic" to={slides[1].to}>
            <div>
              <p className="hero-kicker">המרפאות</p>
              <h2>קובעים תור</h2>
              <p>מדידה וייעוץ במרפאה, ובאותו ביקור רואים את המוצרים.</p>
              <span className="hero-cta">לקביעת תור</span>
            </div>
            <img src="/products/knee-sleeve.jpg" alt="" />
          </Link>
          <Link className="hero-slide hero-sale" to={slides[2].to}>
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
        <button type="button" className="cat-arrow hero-arrow cat-next" aria-label="שקף הבא" onClick={() => moveSlide('next')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.6 6.4 9 12l5.6 5.6L16 16.2 11.8 12 16 7.8z" /></svg>
        </button>
        <div className="hero-dots">
          {slides.map((item, index) => (
            <button key={item.id} type="button" className={slide === index ? 'on' : ''} aria-label={`שקף ${index + 1}`} onClick={() => setSlide(index)} />
          ))}
        </div>
      </section>

      <section className="home-cats">
        <div className="section-head">
          <h2>קטגוריות</h2>
          <Link to="/catalog">לכל הקטלוג</Link>
        </div>
        {!ready ? <p className="muted">טוען קטגוריות...</p> : null}
        {error ? <p className="form-errors">{error}</p> : null}
        {ready && !error && categories.length === 0 ? <p className="muted">עדיין אין קטגוריות.</p> : null}
        <div className="cat-rail">
          <button type="button" className="cat-arrow cat-prev" aria-label="קטגוריות קודמות" disabled={!catEnds.prev} onClick={() => moveCats('prev')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.4 6.4 15 12l-5.6 5.6L8 16.2 12.2 12 8 7.8z" /></svg>
          </button>
          <div className="cat-showcase" ref={catsRef}>
            {categories.map((category) => (
              <Link key={category.id} className="cat-tile" to={`/catalog?cat=${category.id}`}>
                <img src={cover(category.id)} alt="" />
                <strong>{category.name}</strong>
              </Link>
            ))}
          </div>
          <button type="button" className="cat-arrow cat-next" aria-label="קטגוריות נוספות" disabled={!catEnds.next} onClick={() => moveCats('next')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.6 6.4 9 12l5.6 5.6L16 16.2 11.8 12 16 7.8z" /></svg>
          </button>
        </div>
      </section>

      <Link className="clinic-banner" to="/account#appointments">
        <div>
          <p className="hero-kicker">שולחים את הקישור ללקוח</p>
          <h2>קביעת תור למרפאה</h2>
          <p>הלקוח נכנס, קובע תור, ובדרך רואה את המוצרים של החנות.</p>
          <span className="hero-cta">לקביעת תור</span>
        </div>
        <img src="/products/knee-sleeve.jpg" alt="" />
      </Link>

      <section>
        <div className="section-head">
          <h2>נוספו עכשיו</h2>
          <Link to="/catalog">לקטלוג</Link>
        </div>
        {ready ? (
          <>
            <div className="product-grid">
              {newest.slice(0, shelfSize.newest).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {newest.length > shelfSize.newest ? (
              <button type="button" className="btn secondary more-products" onClick={() => setShelfSize((current) => ({ ...current, newest: current.newest + 10 }))}>
                הצג עוד
              </button>
            ) : null}
          </>
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
          <>
            <div className="product-grid">
              {best.slice(0, shelfSize.best).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {best.length > shelfSize.best ? (
              <button type="button" className="btn secondary more-products" onClick={() => setShelfSize((current) => ({ ...current, best: current.best + 10 }))}>
                הצג עוד
              </button>
            ) : null}
          </>
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
          {recommended.slice(0, shelfSize.recommended).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {recommended.length > shelfSize.recommended ? (
          <button type="button" className="btn secondary more-products" onClick={() => setShelfSize((current) => ({ ...current, recommended: current.recommended + 10 }))}>
            הצג עוד
          </button>
        ) : null}
      </section>
    </div>
  )
}
