import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitle } from '../components/ui'

type StaffUser = { id: string; name: string; username: string }
type Punch = { kind: string; at: string; lat: number | null; lng: number | null }

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

export function StaffPage() {
  useTitle('נוכחות')
  const [employee, setEmployee] = useState<StaffUser | null>(null)
  const [last, setLast] = useState<Punch | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function load() {
    const data = await staffFetch<{ employee: StaffUser; last: Punch | null }>('/api/staff/me')
    setEmployee(data.employee)
    setLast(data.last)
  }

  useEffect(() => {
    void load().catch(() => setEmployee(null))
  }, [])

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

  return (
    <main className="admin-login">
      <div className="panel form">
        <img className="admin-logo" src="/logo.jpg" alt="PRO PHARM" />
        <h1>דיווח נוכחות</h1>
        {employee ? (
          <>
            <p>שלום {employee.name}</p>
            <p className="muted">המיקום נשמר רק ברגע דיווח כניסה או יציאה, אחרי אישור בדפדפן.</p>
            {last ? (
              <p>
                דיווח אחרון: {last.kind === 'in' ? 'כניסה' : 'יציאה'} · {new Date(last.at).toLocaleString('he-IL')}
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
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                void staffFetch('/api/staff/logout', { method: 'POST' }).then(() => setEmployee(null))
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
