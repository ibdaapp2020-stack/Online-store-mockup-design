import { Link } from 'react-router-dom'
import { Summary } from '../components/Summary'
import { Empty, Qty } from '../components/ui'
import { money, quote } from '../pricing'
import { useStore } from '../store'

export function CartPage() {
  const { audience, products, cart, setQty, removeFromCart, setSetupQty, pricesOpen } = useStore()
  if (!audience) return null
  const priced = quote(products, cart, audience, 'standard')
  const locked = audience === 'business' && !pricesOpen

  if (priced.lines.length === 0) {
    return (
      <div className="wrap">
        <Empty title="הסל ריק" text="אפשר להתחיל מקטגוריה, או להוסיף סטאפ שלם בלחיצה." to="/shop" action="לחנות" />
      </div>
    )
  }

  const complete = priced.progress.filter((item) => item.complete && item.filledRoles.length > 0)

  return (
    <div className="wrap cart-layout">
      <div>
        <h1>הסל</h1>
        <p className="muted">{priced.lines.length} פריטים במסלול הקנייה הרגיל</p>
        <div className="lines">
          {priced.lines.map((line) => (
            <article key={line.product.id} className="line">
              <div>
                <Link to={`/p/${line.product.id}`}>
                  <strong>{line.product.name}</strong>
                </Link>
                <p className="muted">
                  {pricesOpen ? `${money(line.unit)} ליחידה` : ''}
                  {line.storage ? ` · ${line.storage}` : ''}
                  {line.color ? ` · ${line.color}` : ''}
                  {pricesOpen && line.volume > 0 ? ` · הנחת כמות ${Math.round(line.volume * 100)}%` : ''}
                </p>
              </div>
              <Qty
                value={line.qty}
                max={Math.max(1, line.product.stock)}
                onChange={(value) => setQty(line.key, value)}
              />
              {pricesOpen && <strong>{money(line.line)}</strong>}
              <button type="button" className="text-btn" onClick={() => removeFromCart(line.key)}>
                הסרה
              </button>
            </article>
          ))}
        </div>
        {audience === 'business' &&
          complete.map((item) => {
            const members = priced.lines.filter((line) => line.product.setupId === item.setup.id)
            const current = members[0]?.qty ?? 1
            const max = Math.min(...members.map((line) => line.product.stock))
            return (
              <div className="stamp" key={item.setup.id}>
                <div>
                  <strong>שכפול {item.setup.name}</strong>
                  <p>קובע את אותה כמות לכל החלקים בערכה.</p>
                </div>
                <Qty value={current} max={Math.max(1, max)} onChange={(value) => setSetupQty(item.setup.id, value)} />
              </div>
            )
          })}
        <div className="hero-actions">
          <Link className="btn btn-primary" to={locked ? '/b2b' : '/checkout'}>
            {locked ? 'לפורטל העסקי' : 'להמשך תשלום'}
          </Link>
          <Link className="btn btn-ghost" to="/c/all">
            להמשיך בקניות
          </Link>
        </div>
      </div>
      {!locked && <Summary ship="standard" />}
    </div>
  )
}
