import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitle } from '../components/ui'

type StaffUser = { id: string; name: string; username: string }
type Punch = { kind: string; at: string; lat: number | null; lng: number | null }
type Shift = { inAt: string; outAt: string; minutes: number }
type WorkDay = { date: string; minutes: number; shifts: Shift[] }
type Correction = { id: string; date: string; kind: string; requestedAt: string; note: string; status: string }
type StaffState = {
  employee: StaffUser
  last: Punch | null
  month: string
  days: WorkDay[]
  totalMinutes: number
  punches: Punch[]
  remind: boolean
  corrections: Correction[]
}

async function staffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה')
  return data
}

function locate(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

function hoursLabel(minutes: number) {
  const whole = Math.max(0, Math.round(minutes))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function StaffPage() {
  useTitle('נוכחות')
  const [session, setSession] = useState<StaffState | null>(null)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function load(nextMonth = month) {
    const data = await staffFetch<StaffState>(`/api/staff/me?month=${nextMonth}`)
    setSession(data)
  }

  useEffect(() => {
    void load(month).catch((reason) => {
      const message = reason instanceof Error ? reason.message : ''
      if (message.includes('נדרשת')) setSession(null)
    })
  }, [month])

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await staffFetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'הכניסה נכשלה')
    }
  }

  async function punch(kind: 'in' | 'out') {
    setNote('מאתר את המיקום...')
    const point = await locate()
    await staffFetch('/api/staff/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, lat: point?.lat, lng: point?.lng }),
    })
    setNote(point ? 'הדיווח נשמר עם מיקום.' : 'הדיווח נשמר בלי מיקום. צריך לאשר גישה למיקום בדפדפן.')
    await load()
  }

  async function correct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await staffFetch('/api/staff/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      })
      event.currentTarget.reset()
      setNote('בקשת התיקון נשלחה למנהל.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'השליחה נכשלה')
    }
  }

  return (
    <main className="staff-page">
      <div className="panel form">
        <img className="admin-logo" src="/logo.jpg" alt="PRO PHARM" />
        <h1>דיווח נוכחות</h1>
        {session ? (
          <>
            <p>שלום {session.employee.name}</p>
            <p className="muted">המיקום נשמר רק ברגע דיווח כניסה או יציאה, אחרי אישור בדפדפן.</p>
            {session.remind ? (
              <p className="reminder">עברו יותר מ-30 דקות מאז דיווח הכניסה. אם השעה לא מדויקת, שלחו תיקון למנהל.</p>
            ) : null}
            {session.last ? (
              <p>
                דיווח אחרון: {session.last.kind === 'in' ? 'כניסה' : 'יציאה'} · {new Date(session.last.at).toLocaleString('he-IL')}
              </p>
            ) : (
              <p className="muted">עדיין אין דיווח.</p>
            )}
            <button className="btn" type="button" onClick={() => void punch('in')}>
              דיווח כניסה
            </button>
            <button className="btn secondary" type="button" onClick={() => void punch('out')}>
              דיווח יציאה
            </button>
            {note ? <p>{note}</p> : null}
            <label className="month-pick">
              חודש
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
            <p>סה״כ החודש: {hoursLabel(session.totalMinutes)}</p>
            <div className="stack-list">
              {session.days.length === 0 ? <p className="muted">אין שעות סגורות בחודש הזה.</p> : null}
              {session.days.map((day) => (
                <article key={day.date}>
                  <strong>{day.date}</strong>
                  <span>{hoursLabel(day.minutes)}</span>
                  <p className="muted">
                    {day.shifts
                      .map(
                        (shift) =>
                          `${new Date(shift.inAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}–${new Date(shift.outAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
                      )
                      .join(' · ')}
                  </p>
                </article>
              ))}
            </div>
            <h2>היסטוריית דיווחים</h2>
            <div className="stack-list">
              {session.punches.map((punch) => (
                <article key={punch.at}>
                  <strong>{punch.kind === 'in' ? 'כניסה' : 'יציאה'}</strong>
                  <span>{new Date(punch.at).toLocaleString('he-IL')}</span>
                </article>
              ))}
            </div>
            <h2>תיקון דיווח למנהל</h2>
            <form onSubmit={correct}>
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
                סוג
                <select name="kind" defaultValue="in">
                  <option value="in">כניסה</option>
                  <option value="out">יציאה</option>
                </select>
              </label>
              <label>
                הסבר
                <textarea name="note" required placeholder="למשל: נכנסתי למשמרת ורק אחרי חצי שעה דיווחתי" />
              </label>
              {error ? <p className="form-errors">{error}</p> : null}
              <button className="btn secondary" type="submit">
                שליחה למנהל
              </button>
            </form>
            <h2>הבקשות שלי</h2>
            <div className="stack-list">
              {session.corrections.length === 0 ? <p className="muted">עדיין אין בקשות.</p> : null}
              {session.corrections.map((item) => (
                <article key={item.id}>
                  <strong>
                    {item.kind === 'in' ? 'כניסה' : 'יציאה'} · {item.date}
                  </strong>
                  <span>{item.status === 'approved' ? 'אושר' : item.status === 'rejected' ? 'נדחה' : 'ממתין'}</span>
                  <p className="muted">{item.note}</p>
                </article>
              ))}
            </div>
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                void staffFetch('/api/staff/logout', { method: 'POST' }).then(() => setSession(null))
              }}
            >
              יציאה מהחשבון
            </button>
          </>
        ) : (
          <form onSubmit={onLogin}>
            <label>
              שם משתמש
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              סיסמה
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error ? <p className="form-errors">{error}</p> : null}
            <button className="btn" type="submit">
              כניסה
            </button>
          </form>
        )}
        <Link to="/">חזרה לחנות</Link>
      </div>
    </main>
  )
}
