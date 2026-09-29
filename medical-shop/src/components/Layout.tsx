import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PICKUP } from '../pickup'
import { money } from '../pricing'
import { useStore } from '../store'

export function Layout() {
  const { cartCount, totals, toast, settings } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="app">
      <div className="sticky-top">
        {settings.showBanner && settings.banner ? <div className="demo-banner">{settings.banner}</div> : null}
        <header className="site-header">
          <div className="header-inner">
            <NavLink to="/" className="logo" end>
              <img src="/logo.jpg" alt="PRO PHARM" />
            </NavLink>
            <form
              className="search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                navigate(`/catalog?q=${encodeURIComponent(query.trim())}`)
              }}
            >
              <input
                aria-label="חיפוש מוצרים"
                placeholder="חיפוש מוצר"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit">חיפוש</button>
            </form>
            <button type="button" className="menu-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              תפריט
            </button>
            <nav className={menuOpen ? 'nav open' : 'nav'}>
              <NavLink to="/" end>
                בית
              </NavLink>
              <NavLink to="/catalog">קטלוג</NavLink>
              <NavLink to="/track">מעקב הזמנה</NavLink>
              <NavLink to="/account">אזור אישי</NavLink>
            </nav>
            <NavLink to="/cart" className="cart-link">
              <span className="cart-sum">{money(totals.total)}</span>
              סל
              <span className="cart-count">{cartCount}</span>
            </NavLink>
          </div>
        </header>
      </div>
      <main className="container page">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <img className="footer-logo" src="/logo.jpg" alt="" />
            <strong>{settings.storeName}</strong>
            <p>{settings.tagline}</p>
          </div>
          <div>
            <strong>איסוף עצמי</strong>
            <p>
              <a href={PICKUP.maps} target="_blank" rel="noreferrer">
                {PICKUP.line}
              </a>
            </p>
          </div>
          <div>
            <strong>יצירת קשר</strong>
            <p>
              <a className="whatsapp-link" href="https://wa.me/972505959596" target="_blank" rel="noreferrer">
                וואטסאפ 0505959596
              </a>
            </p>
            <p>
              <a href="mailto:propharm2026@gmail.com">propharm2026@gmail.com</a>
            </p>
          </div>
          <div>
            <strong>האתר אינו בית מרקחת ואינו מחליף ייעוץ רפואי.</strong>
            <p>{settings.disclaimer}</p>
          </div>
        </div>
      </footer>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      <a className="whatsapp" href="https://wa.me/972505959596" target="_blank" rel="noreferrer">
        וואטסאפ
      </a>
    </div>
  )
}
