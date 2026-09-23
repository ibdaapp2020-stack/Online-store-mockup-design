import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Summary } from '../components/Summary'
import { money, quote } from '../pricing'
import { useStore } from '../store'
import type { ShipMethod } from '../types'

const shipLabel: Record<ShipMethod, string> = {
  standard: 'שליח עד הבית',
  express: 'אקספרס, מחר',
  pickup: 'איסוף עצמי',
}

export function Checkout() {
  const { audience, products, cart, placeOrder, pricesOpen, club } = useStore()
  const navigate = useNavigate()
  const [ship, setShip] = useState<ShipMethod>('standard')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: club?.name ?? '',
    phone: club?.phone ?? '',
    email: club?.email ?? '',
    company: '',
    hp: '',
    city: '',
    street: '',
    note: '',
    payment: audience === 'business' ? 'שוטף +30' : 'Visa',
    payments: '1',
  })

  if (!audience) return null
  if (audience === 'business' && !pricesOpen) return <Navigate to="/b2b" replace />
  const priced = quote(products, cart, audience, ship)
  if (priced.lines.length === 0) return <Navigate to="/cart" replace />

  const methods: ShipMethod[] = audience === 'business' ? ['standard', 'pickup'] : ['standard', 'express', 'pickup']
  const paymentOptions =
    audience === 'business'
      ? ['שוטף +30', 'שוטף +60', 'העברה בנקאית', 'Visa', 'Mastercard', 'ישראכרט', 'שיק']
      : ['Visa', 'Mastercard', 'ישראכרט', 'אמריקן אקספרס', 'דיינרס', 'Bit', 'PayBox', 'Apple Pay', 'Google Pay', 'העברה בנקאית']
  const cardPayments = ['Visa', 'Mastercard', 'ישראכרט', 'אמריקן אקספרס', 'דיינרס']
  const activePayment = paymentOptions.includes(form.payment) ? form.payment : paymentOptions[0]

  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const submit = (kind: 'order' | 'quote') => {
    const next: Record<string, string> = {}
    if (!form.email.includes('@')) next.email = 'צריך אימייל כדי לשלוח חשבונית'
    if (audience === 'business') {
      if (form.company.trim().length < 2) next.company = 'חסר שם חברה'
      if (form.hp.replace(/\D/g, '').length !== 9) next.hp = 'ח.פ צריך 9 ספרות'
      if (form.name.trim().length < 2) next.name = 'חסר איש קשר'
      if (!form.email.includes('@')) next.email = 'אימייל לא תקין'
    } else if (form.name.trim().length < 2) {
      next.name = 'חסר שם מלא'
    }
    if (form.phone.replace(/\D/g, '').length < 9) next.phone = 'טלפון לא תקין'
    if (ship !== 'pickup') {
      if (form.city.trim().length < 2) next.city = 'חסרה עיר'
      if (form.street.trim().length < 2) next.street = 'חסרה כתובת'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const id = placeOrder({
      kind,
      ship,
      payment: activePayment,
      payments: cardPayments.includes(activePayment) ? Number(form.payments) : 1,
      customer: {
        name: audience === 'business' ? `${form.company.trim()} · ${form.name.trim()}` : form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: ship === 'pickup' ? 'איסוף עצמי' : `${form.street.trim()}, ${form.city.trim()}`,
        note: [form.note.trim(), form.hp.trim() ? `ח.פ ${form.hp.trim()}` : ''].filter(Boolean).join(' · '),
      },
    })
    if (id) navigate(`/thanks/${id}`)
  }

  return (
    <div className="wrap check">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit('order')
        }}
      >
        <h1>{audience === 'business' ? 'הזמנה או הצעת מחיר' : 'תשלום'}</h1>
        <p className="fine">חשבונית תיפתח אוטומטית לאימייל.</p>
        {audience === 'private' && club && <p className="saving">ההזמנה מוסיפה {Math.floor(priced.total / 10)} נקודות למועדון</p>}

        <fieldset>
          <legend>משלוח</legend>
          <div className="choice-row">
            {methods.map((method) => {
              const option = quote(products, cart, audience, method)
              return (
                <label key={method} className={ship === method ? 'choice on' : 'choice'}>
                  <input type="radio" name="ship" checked={ship === method} onChange={() => setShip(method)} />
                  <span>{shipLabel[method]}</span>
                  <b>{option.shipping === 0 ? 'חינם' : money(option.shipping)}</b>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="form-grid">
          {audience === 'business' && (
            <>
              <Field label="שם חברה" error={errors.company}>
                <input value={form.company} onChange={set('company')} autoComplete="organization" />
              </Field>
              <Field label="ח.פ" error={errors.hp}>
                <input value={form.hp} onChange={set('hp')} inputMode="numeric" dir="ltr" />
              </Field>
            </>
          )}
          <Field label={audience === 'business' ? 'איש קשר' : 'שם מלא'} error={errors.name}>
            <input value={form.name} onChange={set('name')} autoComplete="name" />
          </Field>
          <Field label="טלפון" error={errors.phone}>
            <input value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" dir="ltr" />
          </Field>
          <Field label="אימייל לחשבונית" error={errors.email}>
            <input value={form.email} onChange={set('email')} autoComplete="email" dir="ltr" />
          </Field>
          {ship !== 'pickup' && (
            <>
              <Field label="עיר" error={errors.city}>
                <input value={form.city} onChange={set('city')} autoComplete="address-level2" />
              </Field>
              <Field label="רחוב ומספר" error={errors.street}>
                <input value={form.street} onChange={set('street')} autoComplete="street-address" />
              </Field>
            </>
          )}
        </div>

        <fieldset>
          <legend>תשלום</legend>
          <div className="choice-row">
            {paymentOptions.map((option) => (
              <label key={option} className={activePayment === option ? 'choice on' : 'choice'}>
                <input
                  type="radio"
                  name="payment"
                  checked={activePayment === option}
                  onChange={() => setForm((prev) => ({ ...prev, payment: option }))}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {cardPayments.includes(activePayment) && priced.total >= 400 && (
            <Field label="תשלומים">
              <select value={form.payments} onChange={set('payments')}>
                <option value="1">תשלום אחד</option>
                <option value="3">3 תשלומים של {money(Math.ceil(priced.total / 3))}</option>
                <option value="6">6 תשלומים של {money(Math.ceil(priced.total / 6))}</option>
                <option value="12">12 תשלומים של {money(Math.ceil(priced.total / 12))}</option>
              </select>
            </Field>
          )}
        </fieldset>

        <Field label="הערה">
          <textarea value={form.note} onChange={set('note')} rows={3} />
        </Field>

        <div className="hero-actions">
          <button type="submit" className="btn btn-primary">
            {audience === 'business' ? 'שליחת הזמנה' : `תשלום ${money(priced.total)}`}
          </button>
          {audience === 'business' && (
            <button type="button" className="btn btn-dark" onClick={() => submit('quote')}>
              בקשת הצעת מחיר
            </button>
          )}
        </div>
        {audience === 'business' && <p className="fine">הזמנה מורידה מלאי. הצעת מחיר נשמרת בלי לגעת במלאי.</p>}
      </form>
      <Summary ship={ship} />
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className={error ? 'field bad' : 'field'}>
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  )
}
