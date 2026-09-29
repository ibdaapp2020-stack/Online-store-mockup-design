import { FormEvent, useEffect, useState } from 'react'
import { useTitle } from '../components/ui'

type Punch = { kind: string; at: string; lat: number | null; lng: number | null; note?: string }
type Shift = { inAt: string; outAt: string; minutes: number }
type WorkDay = { date: string; minutes: number; shifts: Shift[] }
type StaffState = {
  employee: { id: string; name: string; username: string }
  last: Punch | null
  month: string
  days: WorkDay[]
  totalMinutes: number
  punches: Punch[]
  remind: boolean
  openShift: { at: string } | null
}

const WEEK = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

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

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
}

function weekday(date: string) {
  const day = new Date(`${date}T12:00:00+03:00`).getUTCDay()
  return WEEK[day] ?? ''
}

function hoursLabel(minutes: number) {
  const whole = Math.max(0, Math.round(minutes))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function StaffPage({ embedded = false, onLeave }: { embedded?: boolean; onLeave?: () => void }) {
  useTitle(embedded ? '' : 'נוכחות')
  const [state, setState] = useState<StaffState | null>(null)
  const [screen, setScreen] = useState<'punch' | 'sheet'>('punch')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteTime, setNoteTime] = useState('09:00')
  const [noteText, setNoteText] = useState('')

  async function load(nextMonth = month) {
    const data = await staffFetch<StaffState>(`/api/staff/me?month=${nextMonth}`)
    setState(data)
    setError('')
  }

  useEffect(() => {
    void load(month).catch(() => setState(null))
  }, [month])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  async function punch(kind: 'in' | 'out') {
    setError('')
    const point = await locate()
    try {
      await staffFetch('/api/staff/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, lat: point?.lat, lng: point?.lng }),
      })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'הדיווח נכשל')
    }
  }

  async function sendNote(event: FormEvent) {
    event.preventDefault()
    if (!noteFor) return
    setError('')
    try {
      await staffFetch('/api/staff/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'note', date: noteFor, time: noteTime, note: noteText.trim() || `שעה נכונה ${noteTime}` }),
      })
      setNoteFor(null)
      setNoteText('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ההערה לא נשלחה')
    }
  }

  async function logout() {
    await fetch('/api/staff/logout', { method: 'POST', credentials: 'include' })
    onLeave?.()
  }

  if (!state) return <p className="muted">טוען את דיווח הנוכחות...</p>

  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  const todayPunches = (state.punches ?? []).filter((item) => item.at.slice(0, 10) === today || new Date(item.at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) === today)

  return (
    <div className="attendance">
      <div className="section-head">
        <h1>{state.employee.name}</h1>
        <button type="button" className="text-btn" onClick={() => void logout()}>
          יציאה
        </button>
      </div>
      <div className="choice-row">
        <button type="button" className={screen === 'punch' ? 'choice on' : 'choice'} onClick={() => setScreen('punch')}>
          דיווח
        </button>
        <button type="button" className={screen === 'sheet' ? 'choice on' : 'choice'} onClick={() => setScreen('sheet')}>
          גיליון נוכחות
        </button>
      </div>
      {state.remind ? <p className="reminder">עברה חצי שעה מהכניסה. אם סיימת, דווח יציאה.</p> : null}
      {error ? <p className="form-errors">{error}</p> : null}

      {screen === 'punch' ? (
        <section className="punch-screen">
          <div className="punch-log">
            {todayPunches.length === 0 ? <p className="muted">עדיין אין דיווח היום</p> : null}
            {todayPunches.map((item) => (
              <p key={`${item.kind}-${item.at}`}>
                <strong>{clock(item.at)}</strong>
                <span>{item.kind === 'in' ? 'כניסה' : item.kind === 'out' ? 'יציאה' : 'הערה'}</span>
                {item.lat != null ? <span className="pin" aria-hidden="true" /> : null}
              </p>
            ))}
          </div>
          <div className="punch-orbs">
            <button type="button" className="punch-orb in" onClick={() => void punch('in')}>
              כניסה
            </button>
            <button type="button" className="punch-orb out" onClick={() => void punch('out')}>
              יציאה
            </button>
          </div>
          <div className="punch-foot">
            <strong>{now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</strong>
            <span className="pin" aria-label="מיקום נשמר רק בזמן הדיווח" />
          </div>
        </section>
      ) : (
        <section className="sheet-screen">
          <label className="month-pick">
            חודש
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <p className="muted">סה״כ {hoursLabel(state.totalMinutes)} בחודש. הערה נשלחת למנהל ומופיעה בהיסטוריה.</p>
          <div className="sheet-table">
            <div className="sheet-head">
              <span>יום</span>
              <span>תאריך</span>
              <span>כניסה</span>
              <span>יציאה</span>
              <span>פעילות</span>
            </div>
            {state.days.length === 0 && !state.openShift ? <p className="muted">אין דיווחים בחודש הזה.</p> : null}
            {state.days.map((day) => {
              const shift = day.shifts[0]
              const notes = (state.punches ?? []).filter((item) => item.kind === 'note' && item.at.startsWith(day.date))
              return (
                <div className="sheet-row" key={day.date}>
                  <span>{weekday(day.date)}</span>
                  <span>{day.date.slice(8)}/{day.date.slice(5, 7)}</span>
                  <span>{shift ? clock(shift.inAt) : ''}</span>
                  <span>{shift ? clock(shift.outAt) : ''}</span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      setNoteFor(day.date)
                      setNoteTime(shift ? clock(shift.inAt) : '09:00')
                      setNoteText('')
                    }}
                  >
                    הערה{notes.length ? ` (${notes.length})` : ''}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {noteFor ? (
        <form className="note-dialog" onSubmit={sendNote}>
          <h2>הערה</h2>
          <label>
            שעה
            <input type="time" value={noteTime} onChange={(event) => setNoteTime(event.target.value)} required />
          </label>
          <label>
            פירוט
            <input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="השעה הנכונה או הסבר" />
          </label>
          <button className="btn" type="submit">
            אישור
          </button>
          <button type="button" className="text-btn" onClick={() => setNoteFor(null)}>
            ביטול
          </button>
        </form>
      ) : null}
    </div>
  )
}
