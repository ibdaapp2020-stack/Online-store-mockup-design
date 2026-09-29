import { useState } from 'react'
import { Link } from 'react-router-dom'
import { productImage } from '../data'
import { EmptyState, QtyControl, useTitle } from '../components/ui'
import { money } from '../pricing'
import { cartKey, useStore } from '../store'
import { variantLabel } from '../types'

export function CartPage() {
  useTitle('סל')
  const { cart, totals, coupon, settings, setQty, removeFromCart, applyCoupon, clearCoupon } = useStore()
  const [code, setCode] = useState('')
  const [couponNote, setCouponNote] = useState('')
  const remaining = Math.max(0, settings.freeFrom - totals.subtotal)

  if (cart.length === 0) {
    return (
      <EmptyState
        title="הסל ריק"
        text="עדיין אין כאן מוצרים. הקטלוג כולו מדומה ואפשר להוסיף ממנו פריטים."
        action={
          <Link className="btn" to="/catalog">
            לקטלוג
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <h1>סל הקניות</h1>
      <div className="cart-layout">
        <div className="panel lines">
          {cart.map((line) => (
            <article key={cartKey(line.productId, line.size, line.color)} className="cart-line">
              <div className="line-swatch">
                <img src={productImage(line.product)} alt="" />
              </div>
              <div>
                <Link to={`/p/${line.productId}`}>{line.product.name}</Link>
                {variantLabel(line) ? <p className="muted">{variantLabel(line)}</p> : null}
                <p className="muted">{money(line.product.price)} ליחידה</p>
                <QtyControl qty={line.qty} max={line.product.stock} onChange={(qty) => setQty(cartKey(line.productId, line.size, line.color), qty)} />
                <button type="button" className="text-btn" onClick={() => removeFromCart(cartKey(line.productId, line.size, line.color))}>
                  הסרה
                </button>
              </div>
              <strong className="line-total">{money(line.product.price * line.qty)}</strong>
            </article>
          ))}
        </div>
        <aside className="panel summary">
          <h2>סיכום</h2>
          <div className="summary-row">
            <span>ביניים</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>הנחה</span>
            <span>{totals.discount ? `−${money(totals.discount)}` : money(0)}</span>
          </div>
          <div className="summary-row">
            <span>משלוח מדומה</span>
            <span>{totals.shipping === 0 ? 'חינם' : money(totals.shipping)}</span>
          </div>
          <p className="muted">
            {remaining > 0 ? `עוד ${money(remaining)} למשלוח חינם.` : 'הגעתם למשלוח חינם.'} החינם מחושב לפני הנחה, מעל {money(settings.freeFrom)}.
          </p>
          {coupon ? (
            <p className="coupon-on">
              קופון {coupon} פעיל (10%)
              <button type="button" className="text-btn" onClick={clearCoupon}>
                הסרת קופון
              </button>
            </p>
          ) : (
            <form
              className="coupon-form"
              onSubmit={(event) => {
                event.preventDefault()
                const ok = applyCoupon(code)
                setCouponNote(ok ? 'ההנחה נוספה לסיכום.' : `הקוד לא מוכר. נסו ${settings.couponCode}.`)
              }}
            >
              <label>
                קופון דמו
                <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={settings.couponCode} />
              </label>
              <button type="submit" className="btn secondary">
                הפעלת קופון
              </button>
            </form>
          )}
          {couponNote ? <p className="muted">{couponNote}</p> : null}
          <div className="summary-row total">
            <span>לתשלום</span>
            <span>{money(totals.total)}</span>
          </div>
          <Link className="btn full" to="/checkout">
            להמשך לתשלום דמו
          </Link>
        </aside>
      </div>
    </div>
  )
}
