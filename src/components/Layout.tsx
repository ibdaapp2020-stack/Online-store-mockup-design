import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PICKUP } from '../pickup'
import { money } from '../pricing'
import { AccessibilityWidget } from './AccessibilityWidget'
import { useStore } from '../store'

export function Layout() {
  const { cartCount, totals, toast, settings, error } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="app">
      <div className="sticky-top">
        {settings.showBanner && settings.banner ? <div className="demo-banner">{settings.banner}</div> : null}
        <header className="site-header">
          <div className="header-inner">
            <div className="brand-bar">
              <NavLink to="/" className="logo" end>
                <img src="/logo.jpg" alt="PRO PHARM" />
              </NavLink>
              <button type="button" className="menu-btn" aria-label="תפריט" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M4 7h16v2H4zm0 4h16v2H4zm0 4h16v2H4z" />
                </svg>
              </button>
              <nav className={menuOpen ? 'nav open' : 'nav'}>
                <NavLink to="/" end>
                  בית
                </NavLink>
                <NavLink to="/catalog">קטלוג</NavLink>
                <NavLink to="/appointments">קביעת תור</NavLink>
                <NavLink to="/track">מעקב</NavLink>
              </nav>
              <NavLink to="/account" className="head-account">
                אזור אישי
              </NavLink>
            </div>
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
              <button type="submit" aria-label="חיפוש">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.49 21.49 20zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  />
                </svg>
              </button>
            </form>
            <NavLink to="/cart" className="cart-link" aria-label="סל">
              <span className="cart-sum">{money(totals.total)}</span>
              <span className="cart-count">{cartCount}</span>
            </NavLink>
          </div>
        </header>
      </div>
      <main className="container page">
        {error ? <p className="store-error" role="alert">{error}</p> : null}
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-sheet">
          <img className="footer-logo" src="/logo.jpg" alt="PRO PHARM" />
          <div className="footer-links">
            <a className="footer-pin" href={PICKUP.maps} target="_blank" rel="noreferrer" aria-label="מיקום">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
              </svg>
            </a>
            <a className="footer-pin footer-waze" href={PICKUP.waze} target="_blank" rel="noreferrer" aria-label="Waze">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 3a8 8 0 0 0-8 8c0 2.4 1.1 4.2 2.2 5.5L7 20.5c.3.6 1.1.7 1.5.2l1.2-1.4A8 8 0 1 0 12 3zm-2.2 8.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zm4.4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zM8.8 13.2c.8 1.4 2 2.1 3.2 2.1s2.4-.7 3.2-2.1" />
              </svg>
            </a>
            <button type="button" className="footer-pin" aria-label="תקנון" onClick={() => setTermsOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V9h4.5L14 4.5zM8 12h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z" />
              </svg>
            </button>
          </div>
          <p className="footer-note">{settings.disclaimer}</p>
          <a className="footer-admin" href="https://portal.propharm.dev/">
            ניהול
          </a>
        </div>
      </footer>
      {termsOpen ? (
        <div className="terms-dialog" role="presentation" onClick={() => setTermsOpen(false)}>
          <div className="terms-sheet" role="dialog" aria-label="תקנון" onClick={(event) => event.stopPropagation()}>
            <h2>תקנון</h2>
            <p>האתר הוא חנות תצוגה. הוא אינו בית מרקחת ואינו מחליף ייעוץ רפואי.</p>
            <p>אין באתר תרופות מרשם. הטקסטים מתארים מוצרים בלבד.</p>
            <p>איסוף עצמי: {PICKUP.line}.</p>
            <p>הרשמה לאזור האישי מעניקה 10% לקנייה הבאה עם הקופון WELCOME10.</p>
            <p>פרטי כרטיס אשראי אינם נשמרים, ואין באתר סליקה אמיתית.</p>
            <button type="button" className="btn" onClick={() => setTermsOpen(false)}>
              סגירה
            </button>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      <AccessibilityWidget />
      <a className="whatsapp" href="https://wa.me/972507111717" target="_blank" rel="noreferrer" aria-label="וואטסאפ">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.12h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.76 13.88c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.41-.14-.95-.31-1.64-.61-2.88-1.25-4.76-4.15-4.9-4.35-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09 1-2.37.24-.28.64-.41.85-.41.21 0 .42 0 .6.01.19.01.45-.07.7.53.26.64.87 2.2.95 2.36.08.16.13.35.03.56-.1.21-.16.34-.31.52-.16.18-.33.4-.47.54-.16.16-.32.32-.14.63.18.31.8 1.32 1.72 2.14 1.18 1.05 2.18 1.38 2.49 1.54.31.16.49.13.67-.08.18-.21.78-.91 1-1.22.21-.31.42-.26.7-.16.28.1 1.79.84 2.1.99.31.16.51.23.59.36.07.13.07.75-.17 1.43z"
          />
        </svg>
      </a>
    </div>
  )
}
