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
  const { products, categories, ready, error, settings } = useStore()
  const newest = products
  const best = [...products].sort((a, b) => Number(b.badge === 'popular') - Number(a.badge === 'popular') || b.reviews - a.reviews)
  const recommended = [...products]
    .filter((product) => !best.slice(0, 10).some((item) => item.id === product.id))
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
  const [shelfSize, setShelfSize] = useState({ newest: 10, best: 10, recommended: 10 })
  const catsRef = useRef<HTMLDivElement>(null)
  const [catEnds, setCatEnds] = useState({ prev: false, next: false })
  const [slide, setSlide] = useState(0)

  const DEFAULT_CATEGORY_SLIDES = [
    {
      id: 'ortho',
      to: '/catalog?cat=ortho',
      badge: '⭐ סדרת הפרימיום · תמיכות ושיקום',
      title: 'חזרה לתנועה מלאה וללא כאבים',
      subtitle: 'תומכי ברך אנטומיים, חגורות גב, קיבועי קרסול ושורש כף יד – לתמיכה אופטימלית בספורט ובשגרה.',
      cta: 'לקולקציית האורתופדיה',
      accentTag: 'טכנולוגיית לחץ אנטומית 3D',
      chips: ['✓ תמיכה אקטיבית', '✓ בד נושם ואלסטי', '✓ הפחתת עומסים'],
      primaryImg: '/products/knee-sleeve.jpg',
      secondaryImg: '/products/wrist-brace.jpg',
      tertiaryImg: '/products/air-ankle.jpg',
      bgColor: 'linear-gradient(135deg, #0b192c 0%, #1e3a8a 52%, #0284c7 100%)',
      glowColor: '#38bdf8',
      custom: false as const,
    },
    {
      id: 'monitors',
      to: '/catalog?cat=monitors',
      badge: '🩺 דיוק קליני מוסמך · בדיקות ביתיות',
      title: 'מעקב רפואי חכם ומדויק בבית',
      subtitle: 'מדי לחץ דם דיגיטליים, מדדי חמצן בדם (אוקסימטרים), מדחומים ומדי סוכר ברמת אמינות של בית חולים.',
      cta: 'למכשירי המדידה והניטור',
      accentTag: '100% דיוק ואישור רפואי',
      chips: ['✓ תוצאה מיידית', '✓ זיכרון מדידות חכם', '✓ קל לתפעול'],
      primaryImg: '/products/bp.png',
      secondaryImg: '/products/oxi.png',
      tertiaryImg: '/products/thermo.png',
      bgColor: 'linear-gradient(135deg, #042f2e 0%, #0d9488 52%, #0ea5e9 100%)',
      glowColor: '#2dd4bf',
      custom: false as const,
    },
    {
      id: 'vitamins',
      to: '/catalog?cat=vitamins',
      badge: '🌿 אנרגיה וחיוניות · 100% רכיבים טבעיים',
      title: 'חיזוק הגוף והמערכת החיסונית',
      subtitle: 'קומפלקס ויטמין D3, מגנזיום ציטראט, אומגה 3 מרוכזת ומולטי-ויטמינים לספיגה מוגברת ולבריאות שיא.',
      cta: 'לתוספי התזונה והויטמינים',
      accentTag: 'פורמולות פרימיום לספיגה מקסימלית',
      chips: ['✓ רכיבים טבעיים', '✓ כשרות מוקפדת', '✓ ללא חומרים משמרים'],
      primaryImg: '/products/omega.png',
      secondaryImg: '/products/vd.png',
      tertiaryImg: '/products/mag.png',
      bgColor: 'linear-gradient(135deg, #064e3b 0%, #059669 52%, #65a30d 100%)',
      glowColor: '#4ade80',
      custom: false as const,
    },
    {
      id: 'first-aid',
      to: '/catalog?cat=first-aid',
      badge: '🚑 מוכנים לכל רגע · ביטחון למשפחה',
      title: 'ערכות עזרה ראשונה וחבישה מקצועית',
      subtitle: 'ערכות חירום שלמות לבית, לרכב ולטיולים, תחבושות אלסטיות, פלסטרים אטומים למים וציוד טיפול מהיר.',
      cta: 'לציוד עזרה ראשונה וחירום',
      accentTag: 'תקן רפואי מתקדם',
      chips: ['✓ עמיד במים ותנאי שטח', '✓ אריזות סטריליות', '✓ מענה מיידי'],
      primaryImg: '/products/kit.png',
      secondaryImg: '/products/plasters.png',
      tertiaryImg: '/products/bandage.png',
      bgColor: 'linear-gradient(135deg, #4c0519 0%, #9f1239 52%, #e11d48 100%)',
      glowColor: '#fb7185',
      custom: false as const,
    },
    {
      id: 'home',
      to: '/catalog?cat=home',
      badge: '🏡 עצמאות, בטיחות ואיכות חיים',
      title: 'עזרי הליכה, רחצה ושיקום ביתי',
      subtitle: 'הליכונים קלים מתקפלים, רולטורים, מקלות הליכה, מושבי רחצה בטיחותיים וארגוניות תרופות חכמות.',
      cta: 'לפתרונות הנגישות והבית',
      accentTag: 'עמידות, קלות משקל ונוחות',
      chips: ['✓ אלומיניום תעופתי קל', '✓ יציבות ובטיחות מקסימלית', '✓ התאמה אישית'],
      primaryImg: '/products/walker-std.jpg',
      secondaryImg: '/products/rollator.jpg',
      tertiaryImg: '/products/cane.png',
      bgColor: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 52%, #6366f1 100%)',
      glowColor: '#818cf8',
      custom: false as const,
    },
  ]

  // Filter out any clinic/appointment slides from the hero slider as requested
  const customSlides = (settings.slides || [])
    .filter((item) => item.active !== false && item.id !== 'slide-clinic' && item.id !== 'clinic' && !item.link?.includes('appointments'))

  const slides = customSlides.length >= 5
    ? customSlides.map((item) => ({
        id: item.id,
        to: item.link || '/catalog',
        title: item.title,
        subtitle: item.subtitle,
        badge: item.badge,
        image: item.image,
        videoUrl: item.videoUrl,
        bgColor: item.bgColor,
        custom: true as const,
      }))
    : DEFAULT_CATEGORY_SLIDES

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
    const cat = categories.find((item) => item.id === id)
    if (cat?.image) return cat.image
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
          {slides.map((item) => {
            if ('custom' in item && item.custom) {
              return (
                <Link
                  key={item.id}
                  className="hero-slide"
                  to={item.to}
                  style={item.bgColor ? { background: item.bgColor } : undefined}
                >
                  <div className="hero-content">
                    {item.badge ? <span className="hero-kicker-badge">{item.badge}</span> : null}
                    <h2>{item.title}</h2>
                    <p>{item.subtitle}</p>
                    <span className="hero-cta-btn">לפרטים וקנייה ←</span>
                  </div>
                  {item.videoUrl ? (
                    <video
                      src={item.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      style={{ maxWidth: '260px', maxHeight: '240px', borderRadius: '14px', objectFit: 'cover' }}
                    />
                  ) : (
                    <img src={item.image || '/logo.jpg'} alt={item.title} />
                  )}
                </Link>
              )
            }
            return (
              <Link
                key={item.id}
                className="hero-slide hero-category-slide"
                to={item.to}
                style={{ background: item.bgColor }}
              >
                <div className="hero-glow hero-glow-1" style={{ background: `radial-gradient(circle, ${item.glowColor}, transparent 70%)` }} />
                <div className="hero-glow hero-glow-2" style={{ background: `radial-gradient(circle, ${item.glowColor}, transparent 70%)` }} />

                <div className="hero-content">
                  <span className="hero-kicker-badge">{item.badge}</span>
                  <h2>{item.title}</h2>
                  <p>{item.subtitle}</p>
                  <span className="hero-cta-btn">
                    {item.cta} ←
                  </span>
                </div>

                <div className="hero-stage">
                  <span className="hero-accent-pill">{item.accentTag}</span>
                  <div className="hero-product-collage">
                    <div className="hero-product-main">
                      <img src={item.primaryImg} alt={item.title} />
                    </div>
                    {item.secondaryImg ? (
                      <div className="hero-product-sub hero-sub-1">
                        <img src={item.secondaryImg} alt="" />
                      </div>
                    ) : null}
                    {item.tertiaryImg ? (
                      <div className="hero-product-sub hero-sub-2">
                        <img src={item.tertiaryImg} alt="" />
                      </div>
                    ) : null}
                  </div>
                  <div className="hero-chips-row">
                    {item.chips.map((chip, cIdx) => (
                      <span key={cIdx} className="hero-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
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

      <Link className="clinic-banner" to="/appointments">
        <div>
          <p className="hero-kicker">שעות פעילות: כל יום מ־09:00 עד 19:00</p>
          <h2>קביעת תור למרפאה</h2>
          <p>3 טיפולים מקצועיים בהתאמה אישית: פיזיותרפיה · טיפול בתא לחץ · טיפול פריצות דיסק</p>
          <span className="hero-cta">לקביעת תור בקליק ←</span>
        </div>
        <div className="clinic-banner-visual">
          <div className="clinic-badge-clock">⏰ פתוח כל יום 09:00–19:00</div>
          <div className="clinic-treatments-tags">
            <span className="clinic-tag-pill">🩺 פיזיותרפיה</span>
            <span className="clinic-tag-pill">💨 תא לחץ (HBOT)</span>
            <span className="clinic-tag-pill">🦴 פריצות דיסק</span>
          </div>
        </div>
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
