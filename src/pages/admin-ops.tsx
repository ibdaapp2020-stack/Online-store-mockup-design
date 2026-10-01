import { FormEvent, useEffect, useState } from 'react'
import { snapshotAdminCatalog } from '../catalog-sync'
import { adminFetch } from '../lib/data/http'
import { watchAdminAppointments, watchAdminCategories, watchAdminCustomers, watchAdminServices } from '../lib/data/admin-live'
import { formatDate, money } from '../pricing'

const DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

type Service = {
  id: string
  name: string
  days: number[]
  openTime: string
  closeTime: string
  slotMinutes: number
  therapist: string
  active: boolean
}

type Appointment = {
  id: string
  serviceId: string
  serviceName: string
  customerName: string
  date: string
  time: string
  therapist: string
  status: string
}

type Member = {
  id: string
  name: string
  email: string
  phone: string
  birthday: string
  city: string
  points: number
  nextPercent: number
  couponCode: string
  couponPercent: number
}
type Shift = { inAt: string; outAt: string; minutes: number }
type WorkDay = { date: string; minutes: number; shifts: Shift[] }
type Correction = { id: string; employeeName: string; date: string; kind: string; requestedAt: string; note: string; status: string }
type StaffCard = {
  id: string
  name: string
  username: string
  payMode: 'hour' | 'global'
  hourlyRate: number
  globalPay: number
  salary: number
  totalMinutes: number
  days: WorkDay[]
  openShift: { at: string } | null
  history?: Array<{ id: string; kind: string; at: string; note: string }>
}
type Mail = { id: string; orderId: string; to: string; status: string; detail: string; createdAt: string }

function shiftTime(time: string, minutes: number) {
  const [hour, minute] = time.split(':').map(Number)
  const total = ((hour * 60 + minute + minutes) % 1440 + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  const intl = digits.startsWith('0') ? `972${digits.slice(1)}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
}

function hoursLabel(minutes: number) {
  const whole = Math.max(0, Math.round(minutes))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function serviceSaveError(reason: unknown) {
  console.error(reason)
  const text = reason instanceof Error ? reason.message : ''
  if (/חסר שם|יש לבחור|לא נמצא/.test(text)) return text
  return 'לא הצלחנו להשלים את הפעולה. נסו שוב.'
}

function ServiceSelect({ services, loading }: { services: Service[]; loading: boolean }) {
  if (loading) return <p className="muted">טוען שירותים...</p>
  if (!services.length) {
    return (
      <>
        <select name="serviceId" required disabled>
          <option value="">אין שירותים זמינים</option>
        </select>
        <p className="muted">אין שירותים זמינים. יש להוסיף שירות תחילה.</p>
      </>
    )
  }
  return (
    <select name="serviceId" required defaultValue={services[0].id}>
      {services.map((service) => (
        <option key={service.id} value={service.id}>
          {service.name}
        </option>
      ))}
    </select>
  )
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadingServices, setLoadingServices] = useState(true)
  const [day, setDay] = useState(() => new Date().toLocaleDateString('en-CA'))

  useEffect(() => {
    const stopServices = watchAdminServices(
      (rows) => {
        setServices(rows)
        setLoadingServices(false)
      },
      (reason) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את השירותים. נסו שוב.')
        setLoadingServices(false)
      },
    )
    const stopAppointments = watchAdminAppointments(
      (rows) => setAppointments(rows as Appointment[]),
      (reason) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את התורים. נסו שוב.')
      },
    )
    return () => {
      stopServices()
      stopAppointments()
    }
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') || '').trim()
    if (!name) {
      setError('חסר שם שירות')
      return
    }
    setError('')
    try {
      const created = await adminFetch<Service>('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          openTime: data.get('openTime'),
          closeTime: data.get('closeTime'),
          slotMinutes: Number(data.get('slotMinutes')),
          therapist: data.get('therapist'),
          days,
        }),
      })
      form.reset()
      setDays([0, 1, 2, 3, 4])
      setServices((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]))
      setNotice('השירות נוסף בהצלחה')
    } catch (reason) {
      setError(serviceSaveError(reason))
    }
  }

  return (
    <div>
      <h1>שירותים ותורים</h1>
      <form className="panel form" onSubmit={create}>
        <label>
          שם השירות
          <input name="name" required />
        </label>
        <div className="choice-row">
          {DAY.map((label, index) => (
            <button
              key={label}
              type="button"
              className={days.includes(index) ? 'choice on' : 'choice'}
              onClick={() => setDays((current) => (current.includes(index) ? current.filter((day) => day !== index) : [...current, index]))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="split-fields">
          <label>
            משעה
            <input name="openTime" type="time" defaultValue="09:00" required />
          </label>
          <label>
            עד שעה
            <input name="closeTime" type="time" defaultValue="17:00" required />
          </label>
        </div>
        <div className="split-fields">
          <label>
            אורך תור בדקות
            <input name="slotMinutes" type="number" min={10} defaultValue={30} required />
          </label>
          <label>
            שם המטפל או הרופא
            <input name="therapist" placeholder="ד״ר כהן" />
          </label>
        </div>
        {error ? <p className="form-errors">{error}</p> : null}
        {notice ? <p className="muted">{notice}</p> : null}
        <button className="btn" type="submit">
          הוספת שירות
        </button>
      </form>
      {loadingServices ? <p className="muted">טוען שירותים...</p> : null}
      {!loadingServices && services.length === 0 ? <p className="muted">אין שירותים זמינים. יש להוסיף שירות תחילה.</p> : null}
      <div className="admin-table">
        {services.map((service) => (
          <article key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <p className="muted">
                {service.therapist ? `${service.therapist} · ` : ''}
                {(Array.isArray(service.days) ? service.days : []).map((day) => DAY[day]).join(', ')} · {service.openTime}–{service.closeTime} · {service.slotMinutes} דק׳
              </p>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                void adminFetch(`/api/admin/services/${service.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...service, active: !service.active }),
                }).catch((reason) => setError(serviceSaveError(reason)))
              }}
            >
              {service.active ? 'הסתרה' : 'הצגה'}
            </button>
          </article>
        ))}
      </div>
      <h2>יומן תורים</h2>
      <div className="choice-row">
        {Array.from({ length: 7 }, (_, index) => {
          const date = new Date()
          date.setDate(date.getDate() + index)
          const value = date.toLocaleDateString('en-CA')
          return (
            <button key={value} type="button" className={day === value ? 'choice on' : 'choice'} onClick={() => setDay(value)}>
              {date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })}
            </button>
          )
        })}
      </div>
      <div className="stack-list">
        {appointments.filter((item) => item.date === day && item.status !== 'cancelled').length === 0 ? <p className="muted">אין תורים ביום הזה.</p> : null}
        {appointments
          .filter((item) => item.date === day)
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((item) => (
            <article key={item.id}>
              <strong>
                {item.time} · {item.serviceName}
              </strong>
              <span>
                {item.customerName}
                {item.therapist ? ` · ${item.therapist}` : ''}
              </span>
              <span>{item.status === 'done' ? 'בוצע' : item.status === 'cancelled' ? 'בוטל' : item.status === 'closed' ? 'סגור' : 'תפוס'}</span>
              <div className="row-actions">
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    const service = services.find((entry) => entry.id === item.serviceId)
                    void adminFetch(`/api/admin/appointments/${item.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ time: shiftTime(item.time, -(service?.slotMinutes || 30)) }),
                    }).catch((reason) => setError(serviceSaveError(reason)))
                  }}
                >
                  שעה קודמת
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    const service = services.find((entry) => entry.id === item.serviceId)
                    void adminFetch(`/api/admin/appointments/${item.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ time: shiftTime(item.time, service?.slotMinutes || 30) }),
                    }).catch((reason) => setError(serviceSaveError(reason)))
                  }}
                >
                  שעה הבאה
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    void adminFetch(`/api/admin/appointments/${item.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: item.status === 'closed' ? 'booked' : 'closed' }),
                    }).catch((reason) => setError(serviceSaveError(reason)))
                  }}
                >
                  {item.status === 'closed' ? 'פתיחה' : 'סגירה'}
                </button>
              </div>
            </article>
          ))}
      </div>
      <h2>קביעת תור מההנהלה</h2>
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          const serviceId = String(data.get('serviceId') || '')
          if (!serviceId) {
            setError('יש לבחור שירות')
            return
          }
          setError('')
          void adminFetch('/api/admin/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceId,
              date: data.get('date'),
              time: data.get('time'),
              customerName: data.get('customerName'),
              therapist: data.get('therapist'),
              phone: data.get('phone'),
              email: data.get('email'),
              createCustomer: data.get('createCustomer') === 'on',
            }),
          })
            .then((created) => {
              const password = (created as { createdPassword?: string }).createdPassword
              form.reset()
              setNotice(password ? `הלקוח נוצר. סיסמה זמנית: ${password}` : 'התור נשמר')
            })
            .catch((reason) => setError(serviceSaveError(reason)))
        }}
      >
        <label>
          שירות
          <ServiceSelect services={services} loading={loadingServices} />
        </label>
        <div className="split-fields">
          <label>
            תאריך
            <input name="date" type="date" required />
          </label>
          <label>
            שעה
            <input name="time" type="time" required />
          </label>
        </div>
        <label>
          מטפל או רופא
          <input name="therapist" placeholder="אם ריק, נשמר שם המטפל של השירות" />
        </label>
        <div className="split-fields">
          <label>
            שם הלקוח
            <input name="customerName" required />
          </label>
          <label>
            טלפון
            <input name="phone" required />
          </label>
        </div>
        <label>
          אימייל, אם פותחים אזור אישי
          <input name="email" type="email" />
        </label>
        <label className="check-line">
          <input name="createCustomer" type="checkbox" />
          הקמת לקוח באזור האישי
        </label>
        <button className="btn" type="submit">
          שמירת תור
        </button>
        {notice ? <p>{notice}</p> : null}
      </form>
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          const serviceId = String(data.get('serviceId') || '')
          if (!serviceId) {
            setError('יש לבחור שירות')
            return
          }
          void adminFetch('/api/admin/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceId,
              date: data.get('date'),
              time: data.get('time'),
              status: 'closed',
              customerName: 'סגור',
            }),
          })
            .then(() => {
              form.reset()
              setNotice('השעה נסגרה ללקוחות')
            })
            .catch((reason) => setError(serviceSaveError(reason)))
        }}
      >
        <h2>סגירת שעה</h2>
        <p className="muted">השעה נתפסת ולא תופיע ללקוחות. אפשר לפתוח אותה שוב מהיומן.</p>
        <label>
          שירות
          <ServiceSelect services={services} loading={loadingServices} />
        </label>
        <div className="split-fields">
          <label>
            תאריך
            <input name="date" type="date" required />
          </label>
          <label>
            שעה
            <input name="time" type="time" required />
          </label>
        </div>
        <button className="btn secondary" type="submit">
          סגירת השעה
        </button>
      </form>
      <h2>תורים שנקבעו</h2>
      <div className="stack-list">
        {appointments.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.serviceName} · {item.customerName}
              </strong>
              <p className="muted">
                {item.date} {item.time}
                {item.therapist ? ` · ${item.therapist}` : ''}
              </p>
            </div>
            <div className="split-fields">
              <input
                type="date"
                value={item.date}
                onChange={(event) => {
                  void adminFetch(`/api/admin/appointments/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: event.target.value }),
                  }).catch((reason) => setError(serviceSaveError(reason)))
                }}
              />
              <input
                type="time"
                value={item.time}
                onChange={(event) => {
                  void adminFetch(`/api/admin/appointments/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ time: event.target.value }),
                  }).catch((reason) => setError(serviceSaveError(reason)))
                }}
              />
            </div>
            <select
              value={item.status}
              onChange={(event) => {
                void adminFetch(`/api/admin/appointments/${item.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: event.target.value }),
                }).catch((reason) => setError(serviceSaveError(reason)))
              }}
            >
              <option value="booked">נקבע</option>
              <option value="done">בוצע</option>
              <option value="cancelled">בוטל</option>
              <option value="closed">סגור</option>
            </select>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (!window.confirm('למחוק את התור?')) return
                void adminFetch(`/api/admin/appointments/${item.id}`, { method: 'DELETE' }).catch((reason) => setError(serviceSaveError(reason)))
              }}
            >
              מחיקה
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

type ShopCategory = { id: string; name: string; blurb: string }

function categoryFormError(reason: unknown) {
  console.error(reason)
  const text = reason instanceof Error ? reason.message : ''
  if (/חסר שם|כבר קיימת|לא נמצאה|יש .+ מוצרים/.test(text)) return text
  return 'לא הצלחנו לשמור את הקטגוריה. נסו שוב.'
}

export function AdminCategories() {
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [blurb, setBlurb] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return watchAdminCategories(
      (rows) => {
        setCategories(rows)
        setLoading(false)
      },
      (reason) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את הקטגוריות. נסו שוב.')
        setLoading(false)
      },
    )
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    const nextBlurb = blurb.trim()
    if (!nextName) {
      setMessage('')
      setError('חסר שם קטגוריה')
      return
    }
    setError('')
    setMessage('')
    setSaving(true)
    try {
      await adminFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, blurb: nextBlurb }),
      })
      setName('')
      setBlurb('')
      setMessage('הקטגוריה נוספה בהצלחה')
      await snapshotAdminCatalog()
    } catch (reason) {
      setError(categoryFormError(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>קטגוריות</h1>
      <p className="muted">קטגוריה חדשה מופיעה בחנות, ואפשר לשייך אליה מוצרים במסך המוצר.</p>
      <form className="panel form" onSubmit={create}>
        <label>
          שם
          <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          תיאור קצר
          <input name="blurb" value={blurb} onChange={(event) => setBlurb(event.target.value)} />
        </label>
        {error ? <p className="form-errors">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'שומר...' : 'הוספת קטגוריה'}
        </button>
      </form>
      {loading ? <p className="muted">טוען קטגוריות...</p> : null}
      {!loading && !error && categories.length === 0 ? <p>עדיין אין קטגוריות.</p> : null}
      <div className="admin-table">
        {categories.map((category) => (
          <article key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <p className="muted">{category.blurb}</p>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                const name = window.prompt('שם הקטגוריה', category.name)
                if (!name) return
                void adminFetch(`/api/admin/categories/${category.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, blurb: category.blurb }),
                })
                  .then(() => snapshotAdminCatalog())
                  .then(() => {
                    setMessage('הקטגוריה עודכנה בהצלחה')
                    setError('')
                  })
                  .catch((reason) => setError(categoryFormError(reason)))
              }}
            >
              עריכה
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (!window.confirm('למחוק את הקטגוריה?')) return
                void adminFetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' })
                  .then(() => snapshotAdminCatalog())
                  .catch((reason) => setError(categoryFormError(reason)))
              }}
            >
              מחיקה
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

export function AdminClub() {
  const [members, setMembers] = useState<Member[]>([])
  const [mail, setMail] = useState<Mail[]>([])
  const [percent, setPercent] = useState(10)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const stop = watchAdminCustomers(
      (rows) => {
        setMembers(rows as Member[])
        setLoadError('')
        setLoading(false)
      },
      (reason) => {
        console.error(reason)
        setLoadError('לא הצלחנו לטעון את הלקוחות. נסו שוב.')
        setLoading(false)
      },
    )
    void adminFetch<Mail[]>('/api/admin/mail').then(setMail).catch(() => setMail([]))
    return stop
  }, [])

  return (
    <div>
      <div className="section-head">
        <h1>מועדון לקוחות</h1>
        <label className="month-pick">
          אחוז לקופון חדש
          <input type="number" min={1} max={100} value={percent} onChange={(event) => setPercent(Number(event.target.value))} />
        </label>
      </div>
      <p className="muted">כל כרטיס מראה מי הלקוח, מה מגיע לו, קופון אישי, ושליחת הודעה לוואטסאפ. הנקודות והאחוז הקבוע נקבעים בהגדרות.</p>
      <div className="club-board">
        {loading ? <p className="muted">טוען לקוחות...</p> : null}
        {loadError ? <p className="form-errors">{loadError}</p> : null}
        {!loading && !loadError && members.length === 0 ? <p>עדיין אין לקוחות רשומים.</p> : null}
        {members.map((member) => (
          <article key={member.id} className="club-card">
            <header>
              <strong>{member.name}</strong>
              <span>{member.city || 'ללא עיר'}</span>
            </header>
            <p>{member.phone}</p>
            <p className="muted">{member.email}</p>
            <p className="muted">{member.birthday ? `יום הולדת ${member.birthday}` : 'ללא יום הולדת'}</p>
            <div className="club-entitlement">
              <span>{member.points} נקודות</span>
              <span>{member.nextPercent ? `${member.nextPercent}% לקנייה הבאה` : 'אין אחוז ממתין'}</span>
            </div>
            <p>{member.couponCode ? `קופון ${member.couponCode} · ${member.couponPercent}%` : 'אין קופון אישי'}</p>
            <div className="row-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  void adminFetch(`/api/admin/customers/${member.id}/coupon`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ percent }),
                  })
                }}
              >
                הפקת קופון
              </button>
              <a
                className="btn secondary"
                href={waLink(
                  member.phone,
                  member.couponCode
                    ? `שלום ${member.name}, קופון אישי ${member.couponCode} להנחה של ${member.couponPercent}% ב-PRO PHARM.`
                    : `שלום ${member.name}, כאן PRO PHARM.`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                שליחת הודעה
              </a>
            </div>
          </article>
        ))}
      </div>
      <h2>עדכוני מייל להזמנות</h2>
      <div className="admin-table">
        {mail.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.orderId}</strong>
              <p className="muted">
                {item.to} · {formatDate(item.createdAt)}
              </p>
              <p>{item.detail}</p>
            </div>
            <span>{item.status === 'sent' ? 'נשלח' : item.status === 'failed' ? 'נכשל' : 'ממתין לסיסמה'}</span>
          </article>
        ))}
      </div>
    </div>
  )
}

export function AdminStaff() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [employees, setEmployees] = useState<StaffCard[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [error, setError] = useState('')

  async function load(nextMonth = month) {
    const data = await adminFetch<{ employees: StaffCard[]; corrections: Correction[] }>(`/api/admin/attendance?month=${nextMonth}`)
    setEmployees(Array.isArray(data.employees) ? data.employees : [])
    setCorrections(Array.isArray(data.corrections) ? data.corrections : [])
  }

  useEffect(() => {
    void load(month).catch((reason) => setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון נוכחות'))
  }, [month])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await adminFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      })
      event.currentTarget.reset()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
    }
  }

  async function savePay(employee: StaffCard, form: FormData) {
    await adminFetch(`/api/admin/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payMode: form.get('payMode'),
        hourlyRate: Number(form.get('hourlyRate')),
        globalPay: Number(form.get('globalPay')),
      }),
    })
    await load()
  }

  return (
    <div>
      <h1>עובדים ונוכחות</h1>
      <form className="panel form" onSubmit={create}>
        <label>
          שם
          <input name="name" required />
        </label>
        <div className="split-fields">
          <label>
            שם משתמש
            <input name="username" required />
          </label>
          <label>
            סיסמה
            <input name="password" type="password" minLength={4} required />
          </label>
        </div>
        {error ? <p className="form-errors">{error}</p> : null}
        <button className="btn" type="submit">
          הוספת עובד
        </button>
      </form>
      <label className="month-pick">
        חודש
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </label>
      <div className="staff-board">
        {employees.map((employee) => (
          <article className="staff-card" key={employee.id}>
            <header>
              <strong>{employee.name}</strong>
              <span className="muted">{employee.username}</span>
            </header>
            {employee.days.length === 0 ? <p className="muted">אין משמרות סגורות בחודש הזה.</p> : null}
            {employee.days.map((day) => (
              <div className="day-row" key={day.date}>
                <span>{day.date}</span>
                <span>
                  {day.shifts.map((shift) => `${new Date(shift.inAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}–${new Date(shift.outAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`).join(' · ')}
                </span>
                <strong>{hoursLabel(day.minutes)}</strong>
              </div>
            ))}
            {employee.openShift ? <p>משמרת פתוחה מ־{new Date(employee.openShift.at).toLocaleString('he-IL')}</p> : null}
            <p>
              סה״כ {hoursLabel(employee.totalMinutes)} · שכר {money(employee.salary)}
            </p>
            <h3>היסטוריית דיווחים</h3>
            {(employee.history ?? []).length === 0 ? <p className="muted">אין דיווחים בחודש הזה.</p> : null}
            {(employee.history ?? []).map((item) => (
              <div className="day-row" key={item.id}>
                <span>{item.kind === 'in' ? 'כניסה' : item.kind === 'out' ? 'יציאה' : 'הערה'}</span>
                <span>{new Date(item.at).toLocaleString('he-IL')}</span>
                <span>{item.note}</span>
              </div>
            ))}
            <form
              className="split-fields"
              onSubmit={(event) => {
                event.preventDefault()
                void savePay(employee, new FormData(event.currentTarget))
              }}
            >
              <label>
                אופן תשלום
                <select name="payMode" defaultValue={employee.payMode}>
                  <option value="hour">לפי שעה</option>
                  <option value="global">גלובלי לחודש</option>
                </select>
              </label>
              <label>
                תשלום שעתי ₪
                <input name="hourlyRate" type="number" min={0} step="0.5" defaultValue={employee.hourlyRate} />
              </label>
              <label>
                סכום גלובלי ₪
                <input name="globalPay" type="number" min={0} step="1" defaultValue={employee.globalPay} />
              </label>
              <button className="btn secondary" type="submit">
                חישוב שכר
              </button>
            </form>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (!window.confirm('למחוק את העובד?')) return
                void adminFetch(`/api/admin/employees/${employee.id}`, { method: 'DELETE' }).then(() => load())
              }}
            >
              מחיקת עובד
            </button>
          </article>
        ))}
      </div>
      <h2>בקשות תיקון</h2>
      <div className="stack-list">
        {corrections.length === 0 ? <p className="muted">אין בקשות תיקון.</p> : null}
        {corrections.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.employeeName} · {item.kind === 'in' ? 'כניסה' : 'יציאה'} · {item.date}
              </strong>
              <p className="muted">{item.note}</p>
              <p>{new Date(item.requestedAt).toLocaleString('he-IL')}</p>
            </div>
            {item.status === 'pending' ? (
              <div className="choice-row">
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    void adminFetch(`/api/admin/corrections/${item.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'approved' }),
                    }).then(() => load())
                  }}
                >
                  אישור
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    void adminFetch(`/api/admin/corrections/${item.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'rejected' }),
                    }).then(() => load())
                  }}
                >
                  דחייה
                </button>
              </div>
            ) : (
              <span>{item.status === 'approved' ? 'אושר' : 'נדחה'}</span>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
