import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, useTitle } from '../components/ui'
import { money } from '../pricing'
import { useStore } from '../store'

type FormState = {
  name: string
  phone: string
  city: string
  address: string
  card: string
  expiry: string
  cvv: string
}

const EMPTY: FormState = { name: '', phone: '', city: '', address: '', card: '', expiry: '', cvv: '' }

function problems(form: FormState) {
  const missing =
    !form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim() || !form.expiry.trim() || !form.cvv.trim()
  const cardDigits = form.card.replace(/\D/g, '')
  const list: string[] = []
  if (missing) list.push('נא למלא את כל השדות')
  if (cardDigits.length !== 16) list.push('מספר הכרטיס חייב להכיל 16 ספרות')
  return list
}

export function CheckoutPage() {
  useTitle('תשלום דמו')
  const { cart, totals, coupon, placeOrder } = useStore()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const [paying, setPaying] = useState(false)

  if (cart.length === 0) {
    return (
      <EmptyState
        title="אין מה לשלם"
        text="הסל ריק, ולכן קופת הדמו לא נפתחת."
        action={
          <Link className="btn" to="/catalog">
            לקטלוג
          </Link>
        }
      />
    )
  }

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const invalid = {
    name: tried && !form.name.trim(),
    phone: tried && !form.phone.trim(),
    city: tried && !form.city.trim(),
    address: tried && !form.address.trim(),
    card: tried && form.card.replace(/\D/g, '').length !== 16,
    expiry: tried && !form.expiry.trim(),
    cvv: tried && !form.cvv.trim(),
  }

  return (
    <div>
      <h1>תשלום להדגמה</h1>
      <p className="notice">תשלום להדגמה בלבד — לא מחויב כסף</p>
      <div className="checkout-grid">
        <form
          className="panel form"
          onSubmit={(event) => {
            event.preventDefault()
            if (paying) return
            setTried(true)
            const nextErrors = problems(form)
            setErrors(nextErrors)
            if (nextErrors.length > 0) return
            setPaying(true)
            window.setTimeout(() => {
              const id = placeOrder({
                name: form.name,
                phone: form.phone,
                city: form.city,
                address: form.address,
              })
              if (id) navigate(`/order/${id}`)
              else setPaying(false)
            }, 700)
          }}
        >
          <h2>פרטי מקבל</h2>
          <label className={invalid.name ? 'invalid' : ''}>
            שם מלא
            <input value={form.name} onChange={(event) => update('name', event.target.value)} autoComplete="off" />
          </label>
          <label className={invalid.phone ? 'invalid' : ''}>
            טלפון
            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="off" />
          </label>
          <div className="split-fields">
            <label className={invalid.city ? 'invalid' : ''}>
              עיר
              <input value={form.city} onChange={(event) => update('city', event.target.value)} autoComplete="off" />
            </label>
            <label className={invalid.address ? 'invalid' : ''}>
              כתובת
              <input value={form.address} onChange={(event) => update('address', event.target.value)} autoComplete="off" />
            </label>
          </div>
          <h2>כרטיס מדומה</h2>
          <p className="muted">כל מספר בן 16 ספרות מתקבל. המספר נשאר בטופס הזה בלבד ולא נשמר.</p>
          <label className={invalid.card ? 'invalid' : ''}>
            מספר כרטיס
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="1111222233334444"
              value={form.card}
              onChange={(event) => update('card', event.target.value)}
            />
          </label>
          <div className="split-fields">
            <label className={invalid.expiry ? 'invalid' : ''}>
              תוקף
              <input placeholder="12/28" value={form.expiry} onChange={(event) => update('expiry', event.target.value)} autoComplete="off" />
            </label>
            <label className={invalid.cvv ? 'invalid' : ''}>
              CVV
              <input inputMode="numeric" autoComplete="off" value={form.cvv} onChange={(event) => update('cvv', event.target.value)} />
            </label>
          </div>
          {errors.length > 0 ? (
            <div role="alert" className="form-errors">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
          <button type="submit" className="btn full" disabled={paying}>
            {paying ? 'מעבד תשלום דמו...' : 'אישור תשלום דמו'}
          </button>
        </form>
        <aside className="panel summary">
          <h2>ההזמנה</h2>
          <ul className="mini-lines">
            {cart.map((line) => (
              <li key={line.productId}>
                <span>
                  {line.product.name} × {line.qty}
                </span>
                <span>{money(line.product.price * line.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row">
            <span>ביניים</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>הנחה {coupon ? `(${coupon})` : ''}</span>
            <span>{totals.discount ? `−${money(totals.discount)}` : money(0)}</span>
          </div>
          <div className="summary-row">
            <span>משלוח</span>
            <span>{totals.shipping === 0 ? 'חינם' : money(totals.shipping)}</span>
          </div>
          <div className="summary-row total">
            <span>סה״כ</span>
            <span>{money(totals.total)}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
