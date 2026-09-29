import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export function Layout() {
  const { cartCount, toast, settings } = useStore()
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
              <span className="logo-mark" aria-hidden="true">
                +
              </span>
              <span>
                מדיקה
                <small>{settings.tagline}</small>
              </span>
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
            </nav>
            <NavLink to="/cart" className="cart-link">
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
        <div className="container">
          <strong>האתר אינו בית מרקחת ואינו מחליף ייעוץ רפואי.</strong>
          <p>{settings.disclaimer}</p>
          <p>
            <a href="/admin">כניסת ניהול</a>
          </p>
        </div>
      </footer>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
