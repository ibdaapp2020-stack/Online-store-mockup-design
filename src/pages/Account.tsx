import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitle } from '../components/ui'
import { portalUrl } from '../lib/surface'
import { formatDate, money } from '../pricing'
import { useStore } from '../store'
import { variantLabel, type Order } from '../types'
import { accountFetch } from '../lib/data/http'
import { StaffPage } from './Staff'

type Member = {
  id: string
  name: string
  phone: string
  email: string
  birthday: string
  city: string
  address: string
  points: number
  nextPercent: number
  couponCode: string
  couponPercent: number
}

type Service = {
  id: string
  name: string
  days: number[]
  openTime: string
  closeTime: string
  slotMinutes: number
  therapist: string
}

type Appointment = {
  id: string
  serviceName: string
  therapist: string
  date: string
  time: string
  status: string
}

const DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const STATUS: Record<string, string> = { booked: 'נקבע', done: 'בוצע', cancelled: 'בוטל', closed: 'סגור' }

export function AccountPage() {
  const { settings } = useStore()
  const [member, setMember] = useState<Member | null>(null)
  const [who, setWho] = useState<'' | 'staff' | 'customer'>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [time, setTime] = useState('')
  useTitle(who === 'staff' ? 'נוכחות' : who === 'customer' ? 'אזור אישי' : 'כניסה')

  async function loadCustomer() {
    const data = await accountFetch<{ customer: Member; orders: Order[]; appointments: Appointment[] }>('/api/account/me')
    setMember(data.customer)
    setOrders(data.orders)
    setAppointments(data.appointments)
    setWho('customer')
    const list = await accountFetch<Service[]>('/api/services')
    setServices(list)
    setServiceId((current) => current || list[0]?.id || '')
  }

  useEffect(() => {
    if (!member || window.location.hash !== '#appointments') return
    document.getElementById('appointments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [member])

  useEffect(() => {
    void accountFetch<{ role?: string }>('/api/session')
      .then((data) => {
        if (data.role === 'admin') window.location.assign(portalUrl('/'))
        else if (data.role === 'staff') setWho('staff')
        else if (data.role === 'customer') void loadCustomer()
      })
      .catch(() => setWho(''))
  }, [])

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([])
      return
    }
    void accountFetch<string[]>(`/api/services/${serviceId}/slots?date=${date}`)
      .then((next) => {
        setSlots(next)
        setTime(next[0] ?? '')
      })
      .catch(() => setSlots([]))
  }, [serviceId, date])

  async function onAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      if (mode === 'register') {
        await accountFetch('/api/account/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(form.entries())),
        })
        await loadCustomer()
        return
      }
      const data = await accountFetch<{ role: string }>('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: form.get('login'), password: form.get('password') }),
      })
      if (data.role === 'admin') window.location.assign(portalUrl('/'))
      else if (data.role === 'staff') setWho('staff')
      else await loadCustomer()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'הכניסה נכשלה')
    }
  }

  async function book(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await accountFetch('/api/account/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, date, time }),
      })
      await loadCustomer()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לקבוע תור')
    }
  }

  if (who === 'staff') {
    return <StaffPage embedded onLeave={() => setWho('')} />
  }

  if (!member) {
    return (
      <div className="summary wide panel">
        <div className="offer-banner">
          <strong>הירשמו וקבלו 10% לקנייה הבאה</strong>
          <p>ההטבה נשמרת בחשבון החדש ומופעלת עם הקופון WELCOME10.</p>
          <p>אחרי הכניסה אפשר גם לקבוע תור למרפאה.</p>
        </div>
        <h1>{mode === 'register' ? 'הרשמה' : 'כניסה'}</h1>
        <div className="choice-row">
          <button type="button" className={mode === 'login' ? 'choice on' : 'choice'} onClick={() => setMode('login')}>
            כניסה
          </button>
          <button type="button" className={mode === 'register' ? 'choice on' : 'choice'} onClick={() => setMode('register')}>
            הרשמת לקוח
          </button>
        </div>
        <form className="form" onSubmit={onAuth}>
          {mode === 'register' ? (
            <>
              <label>
                שם
                <input name="name" required />
              </label>
              <label>
                טלפון
                <input name="phone" required />
              </label>
              <label>
                יום הולדת
                <input name="birthday" type="date" required />
              </label>
              <div className="split-fields">
                <label>
                  עיר
                  <input name="city" required />
                </label>
                <label>
                  כתובת
                  <input name="address" required />
                </label>
              </div>
              <label>
                אימייל
                <input name="email" type="email" required />
              </label>
            </>
          ) : (
            <label>
              שם משתמש או אימייל
              <input name="login" autoComplete="username" required />
            </label>
          )}
          <label>
            סיסמה
            <input name="password" type="password" minLength={4} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </label>
          {error ? <p className="form-errors">{error}</p> : null}
          <button className="btn" type="submit">
            {mode === 'login' ? 'כניסה' : 'הרשמה וקבלת 10%'}
          </button>
        </form>
      </div>
    )
  }

  const selected = services.find((service) => service.id === serviceId)

  return (
    <div>
      <div className="section-head">
        <h1>שלום {member.name}</h1>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            void accountFetch('/api/account/logout', { method: 'POST' }).then(() => {
              setMember(null)
              setWho('')
            })
          }}
        >
          יציאה
        </button>
      </div>
      <div className="account-grid">
        <article className="panel">
          <h2>מועדון לקוחות</h2>
          {settings.loyaltyMode === 'percent' ? (
            <>
              <p>החנות מעניקה {settings.clubPercent}% הנחה לקנייה הבאה אחרי כל הזמנה.</p>
              <p>
                <strong>{member.nextPercent ? `${member.nextPercent}% ממתינים לקנייה הבאה` : 'ההנחה תיפתח אחרי ההזמנה הראשונה'}</strong>
              </p>
            </>
          ) : (
            <>
              <p>על כל 100 ₪ נצברות {settings.pointsPer100} נקודות.</p>
              <p className="order-id">{member.points}</p>
              <p className="muted">נקודות שנצברו</p>
            </>
          )}
          {member.couponCode ? (
            <p>
              קופון אישי <strong>{member.couponCode}</strong> · {member.couponPercent}%
            </p>
          ) : null}
          {member.birthday ? <p className="muted">יום הולדת {member.birthday}</p> : null}
          {member.city ? (
            <p className="muted">
              {member.address}, {member.city}
            </p>
          ) : null}
        </article>
        <form id="appointments" className="panel form" onSubmit={book}>
          <h2>קביעת תור</h2>
          <label>
            שירות
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                  {service.therapist ? ` · ${service.therapist}` : ''}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className="muted">
              {selected.therapist ? `מטפל: ${selected.therapist} · ` : ''}
              {selected.days.map((day) => DAY[day]).join(', ')} · {selected.openTime}–{selected.closeTime}
            </p>
          ) : null}
          <label>
            תאריך
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <div className="choice-row">
            {slots.map((slot) => (
              <button key={slot} type="button" className={time === slot ? 'choice on' : 'choice'} onClick={() => setTime(slot)}>
                {slot}
              </button>
            ))}
          </div>
          {date && slots.length === 0 ? <p className="muted">אין שעות פנויות ביום הזה.</p> : null}
          {error ? <p className="form-errors">{error}</p> : null}
          <button className="btn" type="submit" disabled={!time}>
            קביעת התור
          </button>
        </form>
      </div>
      <section>
        <h2>התורים שלי</h2>
        {appointments.length === 0 ? <p className="muted">עדיין אין תורים.</p> : null}
        <div className="order-list">
          {appointments.map((item) => (
            <article key={item.id} className="order-pill">
              <strong>{item.serviceName}</strong>
              <span>
                {item.date} · {item.time}
                {item.therapist ? ` · ${item.therapist}` : ''}
              </span>
              <span>{STATUS[item.status] ?? item.status}</span>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>ההזמנות שלי</h2>
        {orders.length === 0 ? <p className="muted">הזמנות שנעשו אחרי הכניסה לחשבון יופיעו כאן.</p> : null}
        <div className="order-list">
          {orders.map((order) => (
            <Link key={order.id} to={`/order/${order.id}`} className="order-pill">
              <strong>{order.id}</strong>
              <span>{formatDate(order.createdAt)}</span>
              <span>
                {money(order.total)}
                {order.items.some((item) => variantLabel(item)) ? '' : ''}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
