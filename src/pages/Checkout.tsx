import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckoutErrorDialog } from '../components/CheckoutErrorDialog'
import { EmptyState, useTitle } from '../components/ui'
import { checkoutErrorView, type CheckoutErrorView } from '../lib/checkout-errors'
import { money } from '../pricing'
import { variantLabel } from '../types'
import { PICKUP } from '../pickup'
import { useStore } from '../store'
import { accountFetch } from '../lib/data/http'

type FormState = {
  name: string
  phone: string
  email: string
  city: string
  address: string
  card: string
  expiry: string
  cvv: string
}

const EMPTY: FormState = { name: '', phone: '', email: '', city: '', address: '', card: '', expiry: '', cvv: '' }
const DECLINED_DEMO = '4000000000000002'

function fieldErrors(form: FormState) {
  const cardDigits = form.card.replace(/\D/g, '')
  const cvv = form.cvv.replace(/\D/g, '')
  const expiry = form.expiry.trim()
  const email = form.email.trim()
  return {
    name: !form.name.trim() ? 'יש להזין שם מלא' : '',
    phone: !form.phone.trim() ? 'יש להזין מספר טלפון' : '',
    email: email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'יש להזין כתובת אימייל תקינה' : '',
    city: !form.city.trim() ? 'יש להזין עיר' : '',
    address: !form.address.trim() ? 'יש להזין כתובת' : '',
    card: cardDigits.length !== 16 ? 'יש להזין מספר כרטיס תקין' : '',
    expiry: !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) ? 'יש לבחור תוקף כרטיס תקין' : '',
    cvv: cvv.length < 3 || cvv.length > 4 ? 'יש להזין CVV תקין' : '',
  }
}

export function CheckoutPage() {
  useTitle('תשלום דמו')
  const { cart, totals, coupon, settings, placeOrder } = useStore()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [savedProfile, setSavedProfile] = useState(false)
  const [tried, setTried] = useState(false)
  const [paying, setPaying] = useState(false)
  const [dialog, setDialog] = useState<CheckoutErrorView | null>(null)

  useEffect(() => {
    void accountFetch<{ customer?: { name: string; phone: string; email?: string; city: string; address: string } }>('/api/account/me')
      .catch(() => null)
      .then((data) => {
        const customer = data?.customer
        if (!customer?.name) return
        setForm((current) => ({
          ...current,
          name: customer.name,
          phone: customer.phone,
          email: customer.email || current.email,
          city: customer.city,
          address: customer.address,
        }))
        setSavedProfile(Boolean(customer.name && customer.phone && customer.city && customer.address))
      })
  }, [])

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

  const fields = fieldErrors(form)
  const invalid = {
    name: tried && Boolean(fields.name),
    phone: tried && Boolean(fields.phone),
    email: tried && Boolean(fields.email),
    city: tried && Boolean(fields.city),
    address: tried && Boolean(fields.address),
    card: tried && Boolean(fields.card),
    expiry: tried && Boolean(fields.expiry),
    cvv: tried && Boolean(fields.cvv),
  }

  async function submit() {
    if (paying) return
    setTried(true)
    setDialog(null)
    const next = fieldErrors(form)
    if (Object.values(next).some(Boolean)) return
    if (form.card.replace(/\D/g, '') === DECLINED_DEMO) {
      setDialog(checkoutErrorView(new Error('התשלום לא אושר')))
      return
    }
    setPaying(true)
    try {
      const order = await placeOrder({
        name: form.name,
        phone: form.phone,
        email: form.email.trim(),
        city: form.city,
        address: form.address,
      })
      navigate(`/order/${order.id}`)
    } catch (reason) {
      console.error(reason)
      setDialog(checkoutErrorView(reason))
      setPaying(false)
    }
  }

  return (
    <div>
      <h1>תשלום להדגמה</h1>
      <p className="notice">{settings.paymentNote}</p>
      <div className="checkout-grid">
        <form
          className="panel form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <h2>פרטי מקבל</h2>
          <p className="muted">
            איסוף עצמי:{' '}
            <a href={PICKUP.maps} target="_blank" rel="noreferrer">
              {PICKUP.line}
            </a>
            . למשלוח עד הבית נשתמש בכתובת השמורה.
          </p>
          {savedProfile ? (
            <p className="profile-note">
              ההזמנה על שם {form.name}, {form.phone}, {form.city}, {form.address}.{' '}
              <Link to="/account">עדכון פרטים</Link>
            </p>
          ) : (
            <>
              <label className={invalid.name ? 'invalid' : ''}>
                שם מלא
                <input value={form.name} onChange={(event) => update('name', event.target.value)} autoComplete="off" />
                {invalid.name ? <span className="field-error">{fields.name}</span> : null}
              </label>
              <label className={invalid.phone ? 'invalid' : ''}>
                טלפון
                <input value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="off" />
                {invalid.phone ? <span className="field-error">{fields.phone}</span> : null}
              </label>
              <div className="split-fields">
                <label className={invalid.city ? 'invalid' : ''}>
                  עיר
                  <input value={form.city} onChange={(event) => update('city', event.target.value)} autoComplete="off" />
                  {invalid.city ? <span className="field-error">{fields.city}</span> : null}
                </label>
                <label className={invalid.address ? 'invalid' : ''}>
                  כתובת
                  <input value={form.address} onChange={(event) => update('address', event.target.value)} autoComplete="off" />
                  {invalid.address ? <span className="field-error">{fields.address}</span> : null}
                </label>
              </div>
            </>
          )}
          <label className={invalid.email ? 'invalid' : ''}>
            אימייל לאישור הזמנה
            <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" placeholder="לא חובה" />
            {invalid.email ? <span className="field-error">{fields.email}</span> : null}
          </label>
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
            {invalid.card ? <span className="field-error">{fields.card}</span> : null}
          </label>
          <div className="split-fields">
            <label className={invalid.expiry ? 'invalid' : ''}>
              תוקף
              <input placeholder="12/28" value={form.expiry} onChange={(event) => update('expiry', event.target.value)} autoComplete="off" />
              {invalid.expiry ? <span className="field-error">{fields.expiry}</span> : null}
            </label>
            <label className={invalid.cvv ? 'invalid' : ''}>
              CVV
              <input inputMode="numeric" autoComplete="off" value={form.cvv} onChange={(event) => update('cvv', event.target.value)} />
              {invalid.cvv ? <span className="field-error">{fields.cvv}</span> : null}
            </label>
          </div>
          <button type="submit" className="btn full" disabled={paying}>
            {paying ? 'מעבד את ההזמנה...' : 'אישור תשלום דמו'}
          </button>
        </form>
        <aside className="panel summary">
          <h2>ההזמנה</h2>
          <ul className="mini-lines">
            {cart.map((line) => (
              <li key={line.productId}>
                <span>
                  {line.product.name}
                  {variantLabel(line) ? ` (${variantLabel(line)})` : ''} × {line.qty}
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
      {dialog ? (
        <CheckoutErrorDialog
          view={dialog}
          onRetry={() => {
            setDialog(null)
            void submit()
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}
