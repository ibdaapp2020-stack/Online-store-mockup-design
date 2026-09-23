import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { visibleCategories, productVisible } from '../data'
import { money, nextGap, quote, unitFor } from '../pricing'
import { useStore } from '../store'
import { Logo } from './ui'

export function Shell() {
  const { audience, products, cart, toast, pricesOpen } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setOpen(false)
    setMenu(false)
    setQuery('')
  }, [location.pathname])

  if (!audience) return <Navigate to="/" replace />

  const count = cart.reduce((sum, line) => sum + line.qty, 0)
  const total = pricesOpen ? quote(products, cart, audience, 'standard').total : 0
  const nav = visibleCategories(audience)
  const results = query.trim()
    ? products
        .filter((product) => {
          const hay = `${product.name} ${product.brand} ${product.blurb}`.toLowerCase()
          return product.active && productVisible(product, audience) && hay.includes(query.trim().toLowerCase())
        })
        .slice(0, 6)
    : []
  const gap = nextGap(products, cart, audience)

  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        לתוכן
      </a>
      <div className="sticky shop-top">
        <div className="wrap topbar">
          <button type="button" className="icon-btn" aria-label="תפריט" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
            <MenuIcon />
          </button>
          <Link to="/shop" className="logo-lock" aria-label="DESIGMA CITY">
            <Logo />
          </Link>
          <div className="top-tools">
            <button type="button" className="icon-btn" aria-label="חיפוש" onClick={() => searchRef.current?.focus()}>
              <SearchIcon />
            </button>
            <Link to="/cart" className="icon-btn" aria-label={pricesOpen ? `סל, סה״כ ${money(total)}` : 'סל'}>
              <CartIcon />
              {count > 0 && <em>{count}</em>}
            </Link>
            <Link to="/b2b" className="icon-btn" aria-label="לקוחות עסקיים">
              <UserIcon />
            </Link>
          </div>
        </div>
        <form
          className="wrap finder"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(`/c/all?q=${encodeURIComponent(query.trim())}`)
            setOpen(false)
          }}
        >
          <input
            ref={searchRef}
            value={query}
            placeholder="חיפוש מוצר"
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            aria-label="חיפוש"
          />
          <button type="submit" aria-label="חיפוש">
            <SearchIcon />
          </button>
          {open && query.trim() && (
            <div className="search-pop">
              {results.length === 0 && <p>אין התאמה</p>}
              {results.map((product) => (
                <Link key={product.id} to={`/p/${product.id}`}>
                  <span>{product.name}</span>
                  {pricesOpen && <b>{money(unitFor(product, audience, 1).unit)}</b>}
                </Link>
              ))}
              <Link to={`/c/all?q=${encodeURIComponent(query.trim())}`}>כל התוצאות</Link>
            </div>
          )}
        </form>
        {menu && (
          <nav className="wrap menu-panel" aria-label="תפריט">
            <Link to="/shop">ראשי</Link>
            <Link to="/c/all">כל המוצרים</Link>
            {nav.map((category) => (
              <Link key={category.id} to={`/c/${category.id}`}>
                {category.name}
              </Link>
            ))}
            <Link to="/lab">מעבדה</Link>
            <Link to="/club">מועדון</Link>
            <Link to="/b2b">לקוחות עסקיים</Link>
          </nav>
        )}
        {location.pathname !== '/shop' && (
          <nav className="wrap cats" aria-label="קטגוריות">
            <NavLink to="/shop">ראשי</NavLink>
            <NavLink to="/c/all">הכל</NavLink>
            {nav.map((category) => (
              <NavLink key={category.id} to={`/c/${category.id}`}>
                {category.name}
              </NavLink>
            ))}
            <NavLink to="/lab">מעבדה</NavLink>
            <NavLink to="/club">מועדון</NavLink>
          </nav>
        )}
      </div>
      {gap?.product && (
        <div className="nudge">
          <div className="wrap">
            <p>
              <b>
                מד {gap.setup.name} {gap.filled}/{gap.total}.
              </b>{' '}
              חסר {gap.role.label}: {gap.product.name}
            </p>
            <Link to={`/p/${gap.product.id}`}>להשלים את המד</Link>
          </div>
        </div>
      )}
      <main id="main" className="page">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap foot">
          <div>
            <Logo />
            <p>חנות גאדג׳טים לסלולר, מחשבים, גיימינג ואביזרים. הקנייה מוכרת, החיסכון מגיע כשהמד מתמלא.</p>
          </div>
          <div>
            <strong>קנייה</strong>
            <Link to="/c/mobile">סלולר</Link>
            <Link to="/c/computer">מחשבים</Link>
            <Link to="/c/gaming">גיימינג</Link>
            <Link to="/c/accessories">אביזרים</Link>
            <Link to="/c/repair">מעבדה עד הבית</Link>
          </div>
          <div>
            <strong>חשבון</strong>
            <Link to="/b2b">לקוחות עסקיים</Link>
            <Link to="/club">מועדון</Link>
            <Link to="/lab">מעבדה</Link>
            <Link to="/">החלפת כניסה</Link>
            <Link to="/cart">הסל</Link>
            <Link to="/admin">ניהול החנות</Link>
          </div>
        </div>
        <div className="wrap legal">DESIGMA CITY · סלולר, מחשבים, גיימינג ומעבדה</div>
      </footer>
      <div className={toast ? 'toast show' : 'toast'} role="status">
        {toast}
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5L20 20.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M6 7h15l-1.6 8.2a1 1 0 0 1-1 .8H9.2a1 1 0 0 1-1-.8L6 7Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 7 5 4H2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="9" cy="19.5" r="1.3" fill="currentColor" />
      <circle cx="17" cy="19.5" r="1.3" fill="currentColor" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19.5c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
