import { Link, useNavigate } from 'react-router-dom'
import { SetupCard } from '../components/SetupCard'
import { ProductCard } from '../components/ProductCard'
import { useEffect, useState } from 'react'
import { photos } from '../catalog'
import { banners, blueprintFor, setups } from '../data'
import { money, quote, setupRateLabel } from '../pricing'
import { useStore } from '../store'

export function Home() {
  const { audience, products, applySetup, pricesOpen } = useStore()
  const navigate = useNavigate()
  if (!audience) return null

  const heroSetup = audience === 'business' ? 'desk' : 'pocket'
  const heroQty = audience === 'business' ? 5 : 1
  const heroLines = blueprintFor(heroSetup, audience).map((id) => ({ productId: id, qty: heroQty }))
  const heroQuote = quote(products, heroLines, audience, 'standard')
  const picks = products
    .filter((product) => product.active)
    .slice()
    .sort((a, b) => {
      const score = (fit: typeof a.fit) => (fit === audience ? 2 : fit === 'all' ? 1 : 0)
      const diff = score(b.fit) - score(a.fit)
      return diff !== 0 ? diff : b.reviews - a.reviews
    })
    .slice(0, 8)

  const steps =
    audience === 'business'
      ? [
          ['01', 'בוחרים ציוד', 'אותן קטגוריות, מחיר לפני מע״מ.'],
          ['02', 'קובעים כמות', 'חמש יחידות וכבר נכנסת הנחת כמות.'],
          ['03', 'משכפלים עמדה', 'מחשב, מקלדת, עכבר ומסך בכמות אחת.'],
          ['04', 'מזמינים או מבקשים הצעה', 'הזמנה מיידית או הצעת מחיר לחשבונית.'],
        ]
      : [
          ['01', 'בוחרים קטגוריה', 'סלולר, מחשבים, גיימינג או אביזרים.'],
          ['02', 'מוסיפים לסל', 'כמו בכל חנות שאתם כבר מכירים.'],
          ['03', 'משלימים את המד', 'ארבעה חלקים נועלים הנחה ומשלוח.'],
          ['04', 'משלמים כרגיל', 'אשראי, ביט, או עד 12 תשלומים.'],
        ]

  const tiles: { title: string; to: string; image: string; featured?: boolean }[] = [
    { title: 'חנות Apple', to: '/c/mobile?sub=iphone', image: photos.iphone18, featured: true },
    { title: 'מק', to: '/c/computer?sub=mac', image: photos.macbookAir },
    { title: 'מחשבים', to: '/c/computer', image: photos.macbookPro },
    { title: 'גיימינג', to: '/c/gaming', image: photos.ps5 },
    { title: 'סמארטפונים', to: '/c/mobile', image: photos.iphone17 },
    { title: 'טאבלטים', to: '/c/computer?sub=tablet', image: photos.ipad },
    { title: 'אביזרים', to: '/c/accessories', image: photos.airpods },
    { title: 'שעונים', to: '/c/accessories?sub=wear', image: photos.watch },
    { title: 'מעבדה עד הבית', to: '/lab', image: photos.iphone16 },
    ...(audience === 'business' ? [{ title: 'ציוד מחלקות', to: '/c/enterprise', image: photos.macbookPro }] : []),
  ]

  return (
    <>
      <section className="wrap mosaic" aria-label="קטגוריות">
        {tiles.map((tile) => (
          <Link key={tile.title} to={tile.to} className={tile.featured ? 'featured' : ''}>
            {tile.featured ? (
              <>
                <img src={tile.image} alt="" />
                <strong>{tile.title}</strong>
              </>
            ) : (
              <>
                <strong>{tile.title}</strong>
                <img src={tile.image} alt="" />
                <span>לקטגוריה</span>
              </>
            )}
          </Link>
        ))}
      </section>

      <section className="hero-band">
        <div className="wrap hero">
          <div>
            <p className="kicker">{audience === 'business' ? 'מחירון מחלקה' : 'מד ההשלמה'}</p>
            <h1>{audience === 'business' ? 'אותה חנות. מחירון של מחלקה.' : 'החנות שקונים בה כמו תמיד.'}</h1>
            <p className="lead">
              {audience === 'business'
                ? 'מחיר לפני מע״מ, הנחת כמות, ושכפול עמדה לכל העובדים בלחיצה. בלי קטלוג אחר ובלי ללמוד אתר חדש.'
                : 'קטגוריה, מוצר, סל, תשלום. מד ההשלמה יושב על הסל, וכשהוא מלא ננעלים 8% ומשלוח חינם.'}
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!pricesOpen && audience === 'business'}
                onClick={() => {
                  applySetup(heroSetup, heroQty)
                  navigate('/cart')
                }}
              >
                {audience === 'business' ? 'הכן 5 עמדות עבודה' : 'התחל מהכיס המושלם'}
              </button>
              <Link className="btn btn-ghost" to="/c/all">
                לכל המוצרים
              </Link>
            </div>
          </div>
          <div className="receipt">
            <span className="seal">{setupRateLabel(audience)} נעול</span>
            <p className="eyebrow">{audience === 'business' ? '5 עמדות עבודה' : 'הכיס המושלם'}</p>
            <div className="rows">
              {pricesOpen ? (
                <>
                  {heroQuote.lines.map((line) => (
                    <div className="row" key={line.product.id}>
                      <span>
                        {line.product.name}
                        {line.qty > 1 ? ` × ${line.qty}` : ''}
                      </span>
                      <span>{money(line.list * line.qty)}</span>
                    </div>
                  ))}
                  {heroQuote.volumeSaved > 0 && (
                    <div className="row">
                      <span>הנחת כמות</span>
                      <span className="saving">−{money(heroQuote.volumeSaved)}</span>
                    </div>
                  )}
                  {heroQuote.discount > 0 && (
                    <div className="row">
                      <span>הנחת השלמה</span>
                      <span className="saving">−{money(heroQuote.discount)}</span>
                    </div>
                  )}
                  <div className="row">
                    <span>משלוח</span>
                    <span>{heroQuote.shipping === 0 ? 'חינם' : money(heroQuote.shipping)}</span>
                  </div>
                  {audience === 'business' && (
                    <div className="row">
                      <span>מע״מ 17%</span>
                      <span>{money(heroQuote.vat)}</span>
                    </div>
                  )}
                  <div className="row total">
                    <span>לתשלום</span>
                    <span>{money(heroQuote.total)}</span>
                  </div>
                </>
              ) : (
                heroQuote.lines.map((line) => (
                  <div className="row" key={line.product.id}>
                    <span>{line.product.name}</span>
                  </div>
                ))
              )}
            </div>
            <Link to="/cart" className="text-link" onClick={() => applySetup(heroSetup, heroQty)}>
              ככה זה נראה בסל
            </Link>
          </div>
        </div>
      </section>

      <Banner />

      <section className="wrap block" id="setups">
        <div className="sec-head">
          <h2>{audience === 'business' ? 'שכפול עמדה' : 'מד ההשלמה'}</h2>
          <p>
            {audience === 'business'
              ? 'בוחרים כמה עמדות, והחנות שמה את אותה כמות על כל חלק בערכה. הנחת כמות נכנסת לבד, וערכה מלאה מוסיפה עוד 4%.'
              : 'כל סטאפ בנוי מארבעה חלקים. כשכולם בסל, ננעלת הנחה של 8% על הערכה ומשלוח חינם. אפשר גם להשלים חלק-חלק.'}
          </p>
        </div>
        <div className="setup-grid">
          {setups.map((setup) => (
            <SetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      </section>

      <section className="wrap block">
        <div className="sec-head">
          <h2>{audience === 'business' ? 'ציוד שעסקים לוקחים קודם' : 'מה שקונים עכשיו'}</h2>
          <Link to="/c/all">לכל הקטלוג</Link>
        </div>
        <div className="grid">
          {picks.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="wrap block">
        <div className="sec-head">
          <h2>ארבעה צעדים, בלי הפתעות</h2>
        </div>
        <div className="steps">
          {steps.map(([index, title, text]) => (
            <article key={index} className="step">
              <b>{index}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="trust">
          {[
            ['משלוח', 'עד הבית, אקספרס או איסוף'],
            ['אחריות', 'עד שנתיים על מכשירים נבחרים'],
            ['החזרה', '14 יום על אביזרים'],
            ['תשלום', audience === 'business' ? 'שוטף +30 או אשראי' : 'אשראי, ביט או תשלומים'],
          ].map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

function Banner() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % banners.length), 5000)
    return () => window.clearInterval(timer)
  }, [])
  const slide = banners[index]

  return (
    <section className="banner" aria-roledescription="carousel">
      {banners.map((item, itemIndex) => (
        <img key={item.to} src={item.image} alt="" className={itemIndex === index ? 'on' : ''} />
      ))}
      <div className="wrap banner-copy">
        <p className="kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <p>{slide.text}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={slide.to}>
            למוצר
          </Link>
        </div>
        <div className="dots">
          {banners.map((item, itemIndex) => (
            <button key={item.to} type="button" className={itemIndex === index ? 'on' : ''} aria-label={item.title} onClick={() => setIndex(itemIndex)} />
          ))}
        </div>
      </div>
    </section>
  )
}
