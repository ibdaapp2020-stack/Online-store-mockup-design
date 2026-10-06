import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { accountFetch } from '../lib/data/http'

type Service = {
  id: string
  name: string
  openTime: string
  closeTime: string
  slotMinutes: number
  therapist: string
  days: number[]
}

const DEFAULT_OPTIONS = [
  {
    id: 'physio',
    name: 'פיזיותרפיה',
    icon: '🩺',
    badge: 'שיקום ותנועה · שעה מלאה',
    desc: 'טיפול שיקומי לכאבי שרירים ושלד, פציעות ספורט, שיפור טווחי תנועה וחזרה לתפקוד מלא.',
    hours: 'כל יום 09:00–19:00 · 60 דק׳',
    therapist: 'פיזיותרפיסט מומחה',
    capacity: 1,
  },
  {
    id: 'hyperbaric',
    name: 'טיפול בתא לחץ',
    icon: '💨',
    badge: 'תא לחץ (HBOT) · עד 2 מטופלים יחד',
    desc: 'העשרת חמצן בלחץ גבוה לזירוז החלמה, שיקום רקמות ודלקות. ניתן להכניס עד 2 מטופלים בו־זמנית!',
    hours: 'כל יום 09:00–19:00 · 60 דק׳',
    therapist: 'מטפל תא לחץ מוסמך',
    capacity: 2,
  },
  {
    id: 'disc',
    name: 'טיפול פריצות דיסק',
    icon: '🦴',
    badge: 'עמוד שדרה וכאב · שעה מלאה',
    desc: 'פרוטוקול טיפול ממוקד לשחרור לחץ עצבי, הקלה בכאבי גב וצוואר תחתונים ושיקום עמוד השדרה.',
    hours: 'כל יום 09:00–19:00 · 60 דק׳',
    therapist: 'מומחה שיקום עמוד שדרה',
    capacity: 1,
  },
]

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialServiceId = searchParams.get('service') || ''

  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialServiceId)
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [slots, setSlots] = useState<string[]>([])
  const [time, setTime] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Customer contact details
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string
    serviceName: string
    date: string
    time: string
    customerName: string
    phone: string
  } | null>(null)

  useEffect(() => {
    void accountFetch<Service[]>('/api/services')
      .then((rows) => {
        if (rows && rows.length > 0) {
          setServices(rows)
        }
      })
      .catch(() => {
        // Fallback already handled via DEFAULT_OPTIONS
      })
  }, [])

  // Sync slots when service or date changes
  useEffect(() => {
    if (!selectedServiceId || !date) {
      setSlots([])
      return
    }
    setLoadingSlots(true)
    setError('')
    setTime('')
    void accountFetch<string[]>(`/api/services/${selectedServiceId}/slots?date=${date}`)
      .then((data) => {
        setSlots(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        // Fallback default slots 09:00 to 19:00 (every slot is a full hour)
        const defaultSlots: string[] = []
        for (let h = 9; h < 19; h++) {
          defaultSlots.push(`${String(h).padStart(2, '0')}:00`)
        }
        setSlots(defaultSlots)
      })
      .finally(() => {
        setLoadingSlots(false)
      })
  }, [selectedServiceId, date])

  const currentOption =
    DEFAULT_OPTIONS.find((opt) => opt.id === selectedServiceId || opt.name.includes(selectedServiceId)) ||
    DEFAULT_OPTIONS.find((opt) => services.find((s) => s.id === selectedServiceId)?.name.includes(opt.name)) ||
    null

  const currentServiceName =
    currentOption?.name || services.find((s) => s.id === selectedServiceId)?.name || 'טיפול במרפאה'

  function handleSelectOption(serviceId: string) {
    setSelectedServiceId(serviceId)
    setSearchParams({ service: serviceId })
    setError('')
    window.scrollTo({ top: 320, behavior: 'smooth' })
  }

  function handleResetSelection() {
    setSelectedServiceId('')
    setSearchParams({})
    setTime('')
    setError('')
    setConfirmedBooking(null)
  }

  async function handleBookSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedServiceId || !date || !time) {
      setError('יש לבחור תאריך ושעה לתור')
      return
    }
    if (!customerName.trim() || !phone.trim()) {
      setError('חובה למלא שם מלא ומספר טלפון')
      return
    }
    setBooking(true)
    setError('')
    try {
      const res = await accountFetch<{ id: string }>('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          serviceName: currentServiceName,
          date,
          time,
          customerName: customerName.trim(),
          phone: phone.trim(),
          note: note.trim(),
        }),
      })
      setConfirmedBooking({
        id: res?.id || 'apt-ok',
        serviceName: currentServiceName,
        date,
        time,
        customerName: customerName.trim(),
        phone: phone.trim(),
      })
      window.scrollTo({ top: 100, behavior: 'smooth' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'קביעת התור נכשלה. נסו שוב.')
    } finally {
      setBooking(false)
    }
  }

  // Next 7 days helper
  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      dateVal: d.toLocaleDateString('en-CA'),
      dayName: i === 0 ? 'היום' : i === 1 ? 'מחר' : DAY_NAMES[d.getDay()],
      dayDate: `${d.getDate()}/${d.getMonth() + 1}`,
    }
  })

  // 1. Success confirmation state
  if (confirmedBooking) {
    return (
      <div className="appointment-page-container">
        <div className="panel appointment-success-card">
          <div className="success-icon-badge">✓</div>
          <h1>התור נקבע בהצלחה!</h1>
          <p className="success-subtitle">
            שלום <strong>{confirmedBooking.customerName}</strong>, פרטי התור נשמרו במערכת ונשלחו למרפאת PRO PHARM.
          </p>

          <div className="appointment-summary-box">
            <div className="summary-row">
              <span className="summary-label">שירות שנבחר:</span>
              <strong className="summary-val">{confirmedBooking.serviceName}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">תאריך:</span>
              <strong className="summary-val">{confirmedBooking.date}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">שעה:</span>
              <strong className="summary-val" style={{ color: '#005a9c', fontSize: '1.2rem' }}>
                {confirmedBooking.time}
              </strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">טלפון ליצירת קשר:</span>
              <strong className="summary-val">{confirmedBooking.phone}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">כתובת המרפאה:</span>
              <strong className="summary-val">מרפאת PRO PHARM</strong>
            </div>
          </div>

          <div className="choice-row" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
            <button type="button" className="btn" onClick={handleResetSelection}>
              קביעת תור נוסף
            </button>
            <Link to="/" className="btn secondary">
              חזרה לדף הבית
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="appointment-page-container">
      <div className="appointment-hero-header">
        <span className="appointment-top-tag">מרפאת מומחים · PRO PHARM</span>
        <h1>קביעת תור למרפאה</h1>
        <p className="appointment-hero-desc">
          שעות פעילות המרפאה: <strong>כל יום מ־09:00 בבוקר עד 19:00 בערב</strong>
        </p>
      </div>

      {error ? <div className="admin-banner-error" style={{ margin: '1rem 0' }}>{error}</div> : null}

      {/* ======================================================== */}
      {/* STEP 1: CHOOSE SERVICE (3 CARDS)                        */}
      {/* ======================================================== */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#163a66' }}>
              1. בחרו את הטיפול המבוקש:
            </h2>
            <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem' }}>
              3 טיפולים מתקדמים בהתאמה אישית עם המומחים של PRO PHARM
            </p>
          </div>
          {selectedServiceId ? (
            <button type="button" className="text-btn" onClick={handleResetSelection}>
              החלף טיפול ↻
            </button>
          ) : null}
        </div>

        <div className="service-selection-grid">
          {DEFAULT_OPTIONS.map((opt) => {
            const isSelected = selectedServiceId === opt.id || selectedServiceId === opt.name
            return (
              <div
                key={opt.id}
                className={`service-select-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectOption(opt.id)}
                role="button"
                tabIndex={0}
              >
                <div className="service-card-top-row">
                  <span className="service-icon">{opt.icon}</span>
                  <span className="service-badge">{opt.badge}</span>
                </div>
                <h3 className="service-title">{opt.name}</h3>
                <p className="service-desc">{opt.desc}</p>
                <div className="service-meta-row">
                  <span className="service-hours-pill">⏰ {opt.hours}</span>
                  <span className="service-cta-text">{isSelected ? '✓ נבחר' : 'בחר טיפול ←'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* STEP 2: DATE & TIME SLOTS (09:00 to 19:00)              */}
      {/* ======================================================== */}
      {selectedServiceId ? (
        <section className="panel appointment-step2-panel" style={{ borderRadius: '16px', padding: '1.5rem', border: '2px solid #005a9c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
            <div>
              <span className="muted" style={{ fontSize: '0.82rem', fontWeight: 600 }}>טיפול שנבחר:</span>
              <h2 style={{ margin: 0, color: '#005a9c', fontSize: '1.3rem' }}>
                {currentOption?.icon} {currentServiceName}
              </h2>
            </div>
            <span className="badge in-stock" style={{ fontSize: '0.88rem', padding: '0.4rem 0.8rem' }}>
              שעות: כל יום 09:00–19:00 · תור של שעה שלמה
            </span>
          </div>

          {(selectedServiceId === 'hyperbaric' || currentServiceName.includes('לחץ') || currentServiceName.includes('חמצן')) ? (
            <div style={{ margin: '0 0 1.25rem 0', padding: '0.75rem 1rem', background: '#e0f2fe', borderRadius: '10px', color: '#0369a1', fontSize: '0.92rem' }}>
              💡 <strong>טיפול בתא לחץ (חמצן):</strong> ניתן להכניס עד 2 מטופלים בו־זמנית באותה השעה. אם מגיעים שניים יחד, ציינו זאת בהערות למטה.
            </div>
          ) : null}

          <form onSubmit={handleBookSubmit}>
            {/* 2A. Day Selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
                2. בחרו תאריך:
              </label>
              <div className="choice-row" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {nextDays.map((d) => (
                  <button
                    key={d.dateVal}
                    type="button"
                    className={date === d.dateVal ? 'choice on' : 'choice'}
                    onClick={() => setDate(d.dateVal)}
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
                  >
                    <strong>{d.dayName}</strong> ({d.dayDate})
                  </button>
                ))}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                תאריך אחר:
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ padding: '0.35rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </label>
            </div>

            {/* 2B. Hour Slots */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
                3. בחרו שעה (תור של שעה מלאה מ־09:00 עד 19:00):
              </label>

              {loadingSlots ? (
                <p className="muted">בודק שעות פנויות ביומן המרפאה...</p>
              ) : slots.length === 0 ? (
                <p className="muted" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  אין שעות פנויות בתאריך זה. אנא בחרו יום אחר.
                </p>
              ) : (
                <div className="appointment-slots-grid">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`slot-chip ${time === s ? 'selected' : ''}`}
                      onClick={() => setTime(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2C. Customer Contact Form */}
            {time ? (
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', marginTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.85rem 0', color: '#163a66', fontSize: '1.1rem' }}>
                  4. פרטי יצירת קשר לאישור התור:
                </h3>

                <div className="split-fields">
                  <label>
                    שם מלא
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="ישראל ישראלי"
                      required
                    />
                  </label>
                  <label>
                    טלפון נייד לתזכורת
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="050-1234567"
                      required
                    />
                  </label>
                </div>

                <label>
                  הערות או פירוט נוסף (אופציונלי)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="למשל: כאבי גב תחתון, פציעת ריצה, הפניה מרופא"
                  />
                </label>

                <div style={{ marginTop: '1.25rem' }}>
                  <button
                    className="btn"
                    type="submit"
                    disabled={booking}
                    style={{ width: '100%', padding: '0.85rem', fontSize: '1.1rem', fontWeight: 800 }}
                  >
                    {booking ? 'קובע תור...' : `אישור וקביעת תור ליום ${date} בשעה ${time} ✓`}
                  </button>
                </div>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  )
}
