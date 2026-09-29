import { FormEvent, useEffect, useState } from 'react'
import { formatDate, money } from '../pricing'

const DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

type Service = {
  id: string
  name: string
  days: number[]
  openTime: string
  closeTime: string
  slotMinutes: number
  active: boolean
}

type Appointment = {
  id: string
  serviceId: string
  serviceName: string
  customerName: string
  date: string
  time: string
  status: string
}

type Member = { id: string; name: string; email: string; phone: string; birthday: string; city: string; points: number; nextPercent: number }
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
}
type Mail = { id: string; orderId: string; to: string; status: string; detail: string; createdAt: string }

function hoursLabel(minutes: number) {
  const whole = Math.max(0, Math.round(minutes))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה')
  return data
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    try {
      const [nextServices, nextAppointments] = await Promise.all([
        adminFetch<Service[]>('/api/admin/services'),
        adminFetch<Appointment[]>('/api/admin/appointments'),
      ])
      setServices(Array.isArray(nextServices) ? nextServices : [])
      setAppointments(Array.isArray(nextAppointments) ? nextAppointments : [])
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את התורים')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await adminFetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          openTime: form.get('openTime'),
          closeTime: form.get('closeTime'),
          slotMinutes: Number(form.get('slotMinutes')),
          days,
        }),
      })
      event.currentTarget.reset()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
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
        <label>
          אורך תור בדקות
          <input name="slotMinutes" type="number" min={10} defaultValue={30} required />
        </label>
        {error ? <p className="form-errors">{error}</p> : null}
        <button className="btn" type="submit">
          הוספת שירות
        </button>
      </form>
      <div className="admin-table">
        {services.map((service) => (
          <article key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <p className="muted">
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
                }).then(load)
              }}
            >
              {service.active ? 'הסתרה' : 'הצגה'}
            </button>
          </article>
        ))}
      </div>
      <h2>קביעת תור מההנהלה</h2>
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault()
          setError('')
          const form = new FormData(event.currentTarget)
          void adminFetch('/api/admin/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceId: form.get('serviceId'),
              date: form.get('date'),
              time: form.get('time'),
              customerName: form.get('customerName'),
              phone: form.get('phone'),
              email: form.get('email'),
              createCustomer: form.get('createCustomer') === 'on',
            }),
          })
            .then((created) => {
              const password = (created as { createdPassword?: string }).createdPassword
              event.currentTarget.reset()
              if (password) setNotice(`הלקוח נוצר. סיסמה זמנית: ${password}`)
              else setNotice('התור נשמר')
              return load()
            })
            .catch((reason) => setError(reason instanceof Error ? reason.message : 'שמירת התור נכשלה'))
        }}
      >
        <label>
          שירות
          <select name="serviceId" required>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
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
                  }).then(load)
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
                  }).then(load)
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
                }).then(load)
              }}
            >
              <option value="booked">נקבע</option>
              <option value="done">בוצע</option>
              <option value="cancelled">בוטל</option>
            </select>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (!window.confirm('למחוק את התור?')) return
                void adminFetch(`/api/admin/appointments/${item.id}`, { method: 'DELETE' }).then(load)
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

export function AdminCategories() {
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [error, setError] = useState('')

  async function load() {
    try {
      setCategories(await adminFetch<ShopCategory[]>('/api/admin/categories'))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון קטגוריות')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await adminFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), blurb: form.get('blurb') }),
      })
      event.currentTarget.reset()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
    }
  }

  return (
    <div>
      <h1>קטגוריות</h1>
      <p className="muted">קטגוריה חדשה מופיעה בחנות, ואפשר לשייך אליה מוצרים במסך המוצר.</p>
      <form className="panel form" onSubmit={create}>
        <label>
          שם
          <input name="name" required />
        </label>
        <label>
          תיאור קצר
          <input name="blurb" />
        </label>
        {error ? <p className="form-errors">{error}</p> : null}
        <button className="btn" type="submit">
          הוספת קטגוריה
        </button>
      </form>
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
                }).then(load)
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
                  .then(load)
                  .catch((reason) => setError(reason instanceof Error ? reason.message : 'מחיקה נכשלה'))
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

  useEffect(() => {
    void adminFetch<Member[]>('/api/admin/customers').then(setMembers).catch(() => setMembers([]))
    void adminFetch<Mail[]>('/api/admin/mail').then(setMail).catch(() => setMail([]))
  }, [])

  return (
    <div>
      <h1>מועדון לקוחות</h1>
      <p className="muted">אופן הצבירה, הנקודות או האחוז לקנייה הבאה נקבעים במסך ההגדרות.</p>
      <div className="admin-table">
        {members.length === 0 ? <p>עדיין אין לקוחות רשומים.</p> : null}
        {members.map((member) => (
          <article key={member.id}>
            <div>
              <strong>{member.name}</strong>
              <p className="muted">
                {member.email} · {member.phone}
                {member.birthday ? ` · יום הולדת ${member.birthday}` : ''}
                {member.city ? ` · ${member.city}` : ''}
              </p>
            </div>
            <span>{member.points} נקודות</span>
            <span>{member.nextPercent ? `${member.nextPercent}% לקנייה הבאה` : 'בלי אחוז ממתין'}</span>
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
