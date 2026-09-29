import { FormEvent, useEffect, useState } from 'react'
import { formatDate } from '../pricing'

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
  serviceName: string
  customerName: string
  date: string
  time: string
  status: string
}

type Member = { id: string; name: string; email: string; phone: string; points: number; nextPercent: number }
type Employee = { id: string; name: string; username: string; active: boolean }
type Punch = { id: string; employeeName: string; kind: string; at: string; lat: number | null; lng: number | null }
type Mail = { id: string; orderId: string; to: string; status: string; detail: string; createdAt: string }

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

  async function load() {
    const [nextServices, nextAppointments] = await Promise.all([
      adminFetch<Service[]>('/api/admin/services'),
      adminFetch<Appointment[]>('/api/admin/appointments'),
    ])
    setServices(nextServices)
    setAppointments(nextAppointments)
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
                {service.days.map((day) => DAY[day]).join(', ')} · {service.openTime}–{service.closeTime} · {service.slotMinutes} דק׳
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
      <h2>תורים שנקבעו</h2>
      <div className="admin-table">
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
    void adminFetch<Member[]>('/api/admin/customers').then(setMembers)
    void adminFetch<Mail[]>('/api/admin/mail').then(setMail)
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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [punches, setPunches] = useState<Punch[]>([])
  const [error, setError] = useState('')

  async function load() {
    const [nextEmployees, nextPunches] = await Promise.all([
      adminFetch<Employee[]>('/api/admin/employees'),
      adminFetch<Punch[]>('/api/admin/attendance'),
    ])
    setEmployees(nextEmployees)
    setPunches(nextPunches)
  }

  useEffect(() => {
    void load()
  }, [])

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
      <div className="admin-table">
        {employees.map((employee) => (
          <article key={employee.id}>
            <div>
              <strong>{employee.name}</strong>
              <p className="muted">{employee.username}</p>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                void adminFetch(`/api/admin/employees/${employee.id}`, { method: 'DELETE' }).then(load)
              }}
            >
              מחיקה
            </button>
          </article>
        ))}
      </div>
      <h2>מעקב נוכחות</h2>
      <div className="admin-table">
        {punches.map((punch) => (
          <article key={punch.id}>
            <div>
              <strong>
                {punch.employeeName} · {punch.kind === 'in' ? 'כניסה' : 'יציאה'}
              </strong>
              <p className="muted">{new Date(punch.at).toLocaleString('he-IL')}</p>
            </div>
            {punch.lat != null && punch.lng != null ? (
              <a href={`https://www.google.com/maps?q=${punch.lat},${punch.lng}`} target="_blank" rel="noreferrer">
                מיקום
              </a>
            ) : (
              <span>בלי מיקום</span>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
