import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTitle } from '../components/ui'
import { formatDate, money } from '../pricing'
import { useStore } from '../store'
import { variantLabel, type Order } from '../types'
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
}

type Service = {
  id: string
  name: string
  days: number[]
  openTime: string
  closeTime: string
  slotMinutes: number
}

type Appointment = {
  id: string
  serviceName: string
  date: string
  time: string
  status: string
}

const DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const STATUS: Record<string, string> = { booked: 'נקבע', done: 'בוצע', cancelled: 'בוטל' }

async function accountFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה')
  return data
}

export function AccountPage() {
  const { settings } = useStore()
  const [member, setMember] = useState<Member | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [time, setTime] = useState('')
  const [params, setParams] = useSearchParams()
  const role = params.get('role') === 'staff' ? 'staff' : params.get('role') === 'admin' ? 'admin' : 'customer'
  useTitle(role === 'staff' ? 'נוכחות' : role === 'admin' ? 'ניהול' : 'אזור אישי')

  function setRole(next: 'customer' | 'staff' | 'admin') {
    const query = new URLSearchParams(params)
    if (next === 'customer') query.delete('role')
    else query.set('role', next)
    setParams(query)
  }

  const gate = (
    <div className="role-bar">
      <button type="button" className={role === 'customer' ? 'chip on' : 'chip'} onClick={() => setRole('customer')}>
        לקוח
      </button>
      <button type="button" className={role === 'staff' ? 'chip on' : 'chip'} onClick={() => setRole('staff')}>
        עובד
      </button>
      <button type="button" className={role === 'admin' ? 'chip on' : 'chip'} onClick={() => setRole('admin')}>
        ניהול
      </button>
    </div>
  )

  async function load() {
    const data = await accountFetch<{ customer: Member; orders: Order[]; appointments: Appointment[] }>('/api/account/me')
    setMember(data.customer)
    setOrders(data.orders)
    setAppointments(data.appointments)
    const list = await accountFetch<Service[]>('/api/services')
    setServices(list)
    setServiceId((current) => current || list[0]?.id || '')
  }

  useEffect(() => {
    void load().catch(() => setMember(null))
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
    const body = Object.fromEntries(form.entries())
    try {
      await accountFetch(mode === 'login' ? '/api/account/login' : '/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await load()
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
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לקבוע תור')
    }
  }

  if (role === 'staff') {
    return (
      <div>
        {gate}
        <StaffPage embedded />
      </div>
    )
  }

  if (role === 'admin') {
    return (
      <div>
        {gate}
        <AdminGate />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="summary wide panel">
        {gate}
        <h1>אזור אישי</h1>
        <p className="muted">כאן רואים את מועדון הלקוחות וקובעים תור לשירותי החנות.</p>
        <div className="choice-row">
          <button type="button" className={mode === 'login' ? 'choice on' : 'choice'} onClick={() => setMode('login')}>
            כניסה
          </button>
          <button type="button" className={mode === 'register' ? 'choice on' : 'choice'} onClick={() => setMode('register')}>
            הרשמה
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
            </>
          ) : null}
          <label>
            אימייל
            <input name="email" type="email" required />
          </label>
          <label>
            סיסמה
            <input name="password" type="password" minLength={4} required />
          </label>
          {error ? <p className="form-errors">{error}</p> : null}
          <button className="btn" type="submit">
            {mode === 'login' ? 'כניסה' : 'פתיחת אזור אישי'}
          </button>
        </form>
      </div>
    )
  }

  const selected = services.find((service) => service.id === serviceId)

  return (
    <div>
      {gate}
      <div className="section-head">
        <h1>שלום {member.name}</h1>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            void accountFetch('/api/account/logout', { method: 'POST' }).then(() => setMember(null))
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
          {member.birthday ? <p className="muted">יום הולדת {member.birthday}</p> : null}
          {member.city ? <p className="muted">{member.address}, {member.city}</p> : null}
        </article>
        <form className="panel form" onSubmit={book}>
          <h2>קביעת תור</h2>
          <label>
            שירות
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className="muted">
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

function AdminGate() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetch('/api/admin/me', { credentials: 'include' }).then((response) => setOpen(response.ok))
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const password = String(new FormData(event.currentTarget).get('password') || '')
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    if (!response.ok) {
      setError('סיסמה שגויה')
      return
    }
    navigate('/admin')
  }

  if (open) {
    return (
      <div className="panel form">
        <h1>ניהול החנות</h1>
        <Link className="btn" to="/admin">
          ללוח הניהול
        </Link>
        <button
          className="text-btn"
          type="button"
          onClick={() => {
            void fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).then(() => setOpen(false))
          }}
        >
          התנתקות
        </button>
      </div>
    )
  }

  return (
    <form className="panel form" onSubmit={onSubmit}>
      <h1>כניסת ניהול</h1>
      <label>
        סיסמה
        <input name="password" type="password" required />
      </label>
      {error ? <p className="form-errors">{error}</p> : null}
      <button className="btn" type="submit">
        כניסה
      </button>
    </form>
  )
}
