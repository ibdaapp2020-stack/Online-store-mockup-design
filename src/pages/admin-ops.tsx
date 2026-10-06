import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  phone?: string
  email?: string
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
  authUid?: string
  active?: boolean
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

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 540
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function generateTimeSlots(openTime: string, closeTime: string, slotMinutes: number): string[] {
  const start = parseTimeToMinutes(openTime || '09:00')
  const end = parseTimeToMinutes(closeTime || '17:00')
  const step = Math.max(10, slotMinutes || 30)
  const slots: string[] = []
  for (let t = start; t < end; t += step) {
    slots.push(minutesToTimeString(t))
  }
  return slots
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadingServices, setLoadingServices] = useState(true)
  const [day, setDay] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [showNewService, setShowNewService] = useState(false)
  const [showAllAppointments, setShowAllAppointments] = useState(false)

  // Quick booking state
  const [bookingSlot, setBookingSlot] = useState<string | null>(null)
  const [bookingCustomerName, setBookingCustomerName] = useState('')
  const [bookingPhone, setBookingPhone] = useState('')
  const [bookingEmail, setBookingEmail] = useState('')
  const [bookingTherapist, setBookingTherapist] = useState('')
  const [bookingCreateCustomer, setBookingCreateCustomer] = useState(false)
  const [bookingSaving, setBookingSaving] = useState(false)

  useEffect(() => {
    const stopServices = watchAdminServices(
      (rows) => {
        if (rows.length === 0) {
          void adminFetch('/api/admin/services').catch(() => {})
        }
        setServices(rows)
        setLoadingServices(false)
        setSelectedServiceId((prev) => {
          if (prev && rows.some((s) => s.id === prev)) return prev
          return rows.length > 0 ? rows[0].id : ''
        })
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

  const currentService = services.find((s) => s.id === selectedServiceId) || services[0]

  async function createService(event: FormEvent<HTMLFormElement>) {
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
      setSelectedServiceId(created.id)
      setShowNewService(false)
      setNotice('השירות נוסף בהצלחה!')
    } catch (reason) {
      setError(serviceSaveError(reason))
    }
  }

  async function quickCloseSlot(slotTime: string) {
    if (!currentService) return
    setError('')
    try {
      await adminFetch('/api/admin/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: currentService.id,
          date: day,
          time: slotTime,
          status: 'closed',
          customerName: 'שעה חסומה',
          therapist: currentService.therapist || '',
        }),
      })
      setNotice(`השעה ${slotTime} נסגרה לקבלת קהל.`)
    } catch (reason) {
      setError(serviceSaveError(reason))
    }
  }

  async function handleQuickBookSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentService || !bookingSlot) return
    if (!bookingCustomerName.trim() || !bookingPhone.trim()) {
      setError('חובה להזין שם לקוח ומספר טלפון')
      return
    }
    setError('')
    setBookingSaving(true)
    try {
      const created = await adminFetch<{ createdPassword?: string }>('/api/admin/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: currentService.id,
          date: day,
          time: bookingSlot,
          customerName: bookingCustomerName.trim(),
          phone: bookingPhone.trim(),
          email: bookingEmail.trim(),
          therapist: bookingTherapist.trim() || currentService.therapist,
          createCustomer: bookingCreateCustomer,
          status: 'booked',
        }),
      })
      const pass = created?.createdPassword
      setNotice(pass ? `התור נקבע בהצלחה! נוצר כרטיס לקוח עם סיסמה: ${pass}` : `התור נקבע בהצלחה לשעה ${bookingSlot}`)
      setBookingSlot(null)
      setBookingCustomerName('')
      setBookingPhone('')
      setBookingEmail('')
      setBookingTherapist('')
      setBookingCreateCustomer(false)
    } catch (reason) {
      setError(serviceSaveError(reason))
    } finally {
      setBookingSaving(false)
    }
  }

  // Generate slots for currentService
  const timeSlots = currentService
    ? generateTimeSlots(currentService.openTime || '09:00', currentService.closeTime || '17:00', currentService.slotMinutes || 30)
    : []

  // Day appointments for current service
  const currentDayAppointments = appointments.filter(
    (item) => currentService && item.serviceId === currentService.id && item.date === day && item.status !== 'cancelled',
  )

  const bookedCount = currentDayAppointments.filter((a) => a.status === 'booked' || a.status === 'done').length
  const closedCount = currentDayAppointments.filter((a) => a.status === 'closed').length
  const freeCount = Math.max(0, timeSlots.length - bookedCount - closedCount)

  return (
    <div className="admin-services-page">
      <div className="admin-header-row">
        <div>
          <h1>שירותים ותורים</h1>
          <p className="muted">ניהול שירותי המרפאה ולוח שעות מהיר – קביעה וסגירה בלחיצה אחת</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => setShowNewService((v) => !v)}
        >
          {showNewService ? '✕ סגור טופס' : '+ שירות חדש'}
        </button>
      </div>

      {notice ? <div className="admin-banner-notice">{notice}</div> : null}
      {error ? <div className="admin-banner-error">{error}</div> : null}

      {/* Form to add a new service */}
      {showNewService ? (
        <form className="panel form" onSubmit={createService} style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '2px solid #005a9c' }}>
          <h3>הוספת שירות חדש למרפאה</h3>
          <label>
            שם השירות
            <input name="name" placeholder="למשל: ייעוץ אורתופדי, התאמת מדרסים" required />
          </label>
          <label>
            ימי פעילות בשבוע
            <div className="choice-row" style={{ marginTop: '0.4rem' }}>
              {DAY.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={days.includes(index) ? 'choice on' : 'choice'}
                  onClick={() => setDays((current) => (current.includes(index) ? current.filter((d) => d !== index) : [...current, index]))}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
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
              <input name="slotMinutes" type="number" min={10} step={5} defaultValue={30} required />
            </label>
            <label>
              שם המטפל או הרופא
              <input name="therapist" placeholder="ד״ר כהן / פיזיותרפיסט" />
            </label>
          </div>
          <div className="choice-row">
            <button className="btn" type="submit">
              שמירת שירות חדש
            </button>
            <button className="btn secondary" type="button" onClick={() => setShowNewService(false)}>
              ביטול
            </button>
          </div>
        </form>
      ) : null}

      {/* Services List at the TOP */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.6rem', color: '#163a66' }}>
          בחירת שירות לצפייה וניהול יומן:
        </h3>
        {loadingServices ? <p className="muted">טוען שירותים...</p> : null}
        {!loadingServices && services.length === 0 ? (
          <p className="muted">עדיין אין שירותים. לחצו על &quot;+ שירות חדש&quot; כדי להתחיל.</p>
        ) : null}
        <div className="admin-service-cards-grid">
          {services.map((service) => {
            const isSelected = currentService?.id === service.id
            return (
              <div
                key={service.id}
                className={`admin-service-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedServiceId(service.id)}
              >
                <div className="service-card-top">
                  <strong className="service-name">{service.name}</strong>
                  <span className={`badge ${service.active ? 'in-stock' : 'out-of-stock'}`}>
                    {service.active ? 'פעיל' : 'מוסתר'}
                  </span>
                </div>
                <div className="service-therapist">
                  👨‍⚕️ {service.therapist || 'רופא / מטפל'}
                </div>
                <div className="service-details muted">
                  🕒 {service.openTime}–{service.closeTime} · {service.slotMinutes} דק׳
                </div>
                <div className="service-days-preview">
                  {(Array.isArray(service.days) ? service.days : []).map((d) => (
                    <span key={d} className="service-day-pill">
                      {DAY[d]}
                    </span>
                  ))}
                </div>
                <div className="service-card-actions" onClick={(e) => e.stopPropagation()}>
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
                    {service.active ? 'הסתר' : 'הפעל'}
                  </button>
                  <button
                    type="button"
                    className="text-btn danger"
                    onClick={() => {
                      if (!window.confirm(`למחוק את השירות "${service.name}"?`)) return
                      void adminFetch(`/api/admin/services/${service.id}`, { method: 'DELETE' })
                        .then(() => setServices((cur) => cur.filter((s) => s.id !== service.id)))
                        .catch((reason) => setError(serviceSaveError(reason)))
                    }}
                  >
                    מחק
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Service Day Schedule & Unified Actions */}
      {currentService ? (
        <section className="panel" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid #d1d5db' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.85rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#005a9c' }}>
                יומן תורים: {currentService.name}
              </h2>
              <p className="muted" style={{ margin: '0.2rem 0 0 0' }}>
                מטפל: {currentService.therapist || 'כללי'} · שעות עבודה: {currentService.openTime}–{currentService.closeTime}
              </p>
            </div>
            {/* Quick Metrics for current day */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
                סה״כ שעות: {timeSlots.length}
              </span>
              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
                פנויות: {freeCount}
              </span>
              <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
                נקבעו: {bookedCount}
              </span>
              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
                סגורות: {closedCount}
              </span>
            </div>
          </div>

          {/* Date Selector Row */}
          <div style={{ margin: '1rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="choice-row" style={{ flexWrap: 'wrap' }}>
                {Array.from({ length: 7 }, (_, index) => {
                  const d = new Date()
                  d.setDate(d.getDate() + index)
                  const val = d.toLocaleDateString('en-CA')
                  const label = index === 0 ? 'היום' : index === 1 ? 'מחר' : DAY[d.getDay()]
                  return (
                    <button
                      key={val}
                      type="button"
                      className={day === val ? 'choice on' : 'choice'}
                      onClick={() => setDay(val)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <strong>{label}</strong> ({d.getDate()}/{d.getMonth() + 1})
                    </button>
                  )
                })}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem' }}>
                תאריך אחר:
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  style={{ padding: '0.35rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </label>
            </div>
          </div>

          {/* Slots Grid */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '1rem 0 0.5rem 0', color: '#334155' }}>
            לוח שעות ליום {new Date(`${day}T12:00:00`).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' })}:
          </h3>

          <div className="admin-slots-grid">
            {timeSlots.map((slot) => {
              const appt = currentDayAppointments.find((a) => a.time === slot)
              const isClosed = appt?.status === 'closed'
              const isBooked = appt && appt.status !== 'closed' && appt.status !== 'cancelled'
              const isDone = appt?.status === 'done'

              return (
                <div
                  key={slot}
                  className={`admin-slot-card ${isBooked ? 'booked' : isClosed ? 'closed' : 'free'}`}
                >
                  <div className="slot-card-header">
                    <span className="slot-time">{slot}</span>
                    {isBooked ? (
                      <span className={`badge ${isDone ? 'done-badge' : 'booked-badge'}`}>
                        {isDone ? 'בוצע ✓' : 'תפוס 👤'}
                      </span>
                    ) : isClosed ? (
                      <span className="badge closed-badge">סגור 🔒</span>
                    ) : (
                      <span className="badge free-badge">פנוי 🟢</span>
                    )}
                  </div>

                  <div className="slot-card-body">
                    {isBooked && appt ? (
                      <div>
                        <strong className="slot-customer-name">{appt.customerName}</strong>
                        {appt.phone ? (
                          <div className="slot-phone-row">
                            <a href={`tel:${appt.phone}`} className="slot-tel-link">
                              📞 {appt.phone}
                            </a>
                            <a
                              href={waLink(appt.phone, `שלום ${appt.customerName}, תזכורת לתור ב-${currentService.name} בתאריך ${day} בשעה ${slot}`)}
                              target="_blank"
                              rel="noreferrer"
                              className="slot-wa-link"
                              title="שלח וואטסאפ"
                            >
                              💬 וואטסאפ
                            </a>
                          </div>
                        ) : null}
                        {appt.therapist ? <div className="slot-therapist-sub">מטפל: {appt.therapist}</div> : null}
                      </div>
                    ) : isClosed ? (
                      <div className="muted" style={{ fontSize: '0.8rem' }}>שעה חסומה לקבלת קהל</div>
                    ) : (
                      <div className="muted" style={{ fontSize: '0.8rem' }}>פנוי להזמנה</div>
                    )}
                  </div>

                  {/* Actions right on the slot! */}
                  <div className="slot-card-actions">
                    {!appt || appt.status === 'cancelled' ? (
                      <>
                        <button
                          type="button"
                          className="btn-slot book"
                          onClick={() => {
                            setBookingSlot(slot)
                            setBookingTherapist(currentService.therapist || '')
                          }}
                        >
                          קבע תור ✚
                        </button>
                        <button
                          type="button"
                          className="btn-slot close"
                          onClick={() => quickCloseSlot(slot)}
                          title="סגור שעה זו לקהל"
                        >
                          סגור שעה 🔒
                        </button>
                      </>
                    ) : isClosed ? (
                      <button
                        type="button"
                        className="btn-slot open"
                        onClick={() => {
                          void adminFetch(`/api/admin/appointments/${appt.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'cancelled' }),
                          }).then(() => setNotice(`השעה ${slot} נפתחה מחדש לקהל`))
                        }}
                      >
                        פתח שעה 🔓
                      </button>
                    ) : (
                      <div className="slot-action-buttons-group">
                        <button
                          type="button"
                          className="btn-slot-sub"
                          title="סמן כבוצע"
                          onClick={() => {
                            void adminFetch(`/api/admin/appointments/${appt.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: isDone ? 'booked' : 'done' }),
                            })
                          }}
                        >
                          {isDone ? 'בטל ביצוע' : 'בוצע ✓'}
                        </button>
                        <button
                          type="button"
                          className="btn-slot-sub danger"
                          title="ביטול תור"
                          onClick={() => {
                            if (!window.confirm(`לבטל את התור של ${appt.customerName}?`)) return
                            void adminFetch(`/api/admin/appointments/${appt.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'cancelled' }),
                            }).then(() => setNotice('התור בוטל והשעה התפנתה'))
                          }}
                        >
                          בטל תור ✕
                        </button>
                        <button
                          type="button"
                          className="btn-slot-sub"
                          title="סגור שעה זו"
                          onClick={() => {
                            void adminFetch(`/api/admin/appointments/${appt.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'closed' }),
                            })
                          }}
                        >
                          חסום 🔒
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Quick Booking Modal */}
      {bookingSlot && currentService ? (
        <div className="admin-modal-overlay" onClick={() => setBookingSlot(null)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>קביעת תור מהירה</h3>
              <button type="button" className="admin-modal-close" onClick={() => setBookingSlot(null)}>
                ✕
              </button>
            </div>
            <div className="admin-modal-summary" style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', color: '#1e40af' }}>
              <strong>{currentService.name}</strong> · יום {day} בשעה <strong>{bookingSlot}</strong> ({currentService.slotMinutes} דק׳)
            </div>
            <form onSubmit={handleQuickBookSubmit} className="form">
              <label>
                שם הלקוח
                <input
                  value={bookingCustomerName}
                  onChange={(e) => setBookingCustomerName(e.target.value)}
                  placeholder="שם מלא"
                  required
                  autoFocus
                />
              </label>
              <label>
                טלפון
                <input
                  value={bookingPhone}
                  onChange={(e) => setBookingPhone(e.target.value)}
                  placeholder="050-1234567"
                  type="tel"
                  required
                />
              </label>
              <div className="split-fields">
                <label>
                  אימייל (אופציונלי)
                  <input
                    value={bookingEmail}
                    onChange={(e) => setBookingEmail(e.target.value)}
                    placeholder="email@example.com"
                    type="email"
                  />
                </label>
                <label>
                  מטפל או רופא
                  <input
                    value={bookingTherapist}
                    onChange={(e) => setBookingTherapist(e.target.value)}
                    placeholder={currentService.therapist || 'ד״ר כהן'}
                  />
                </label>
              </div>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={bookingCreateCustomer}
                  onChange={(e) => setBookingCreateCustomer(e.target.checked)}
                />
                הקמת כרטיס לקוח במועדון האתר
              </label>
              <div className="choice-row" style={{ marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={bookingSaving}>
                  {bookingSaving ? 'שומר...' : `אשר קביעת תור ל-${bookingSlot}`}
                </button>
                <button className="btn secondary" type="button" onClick={() => setBookingSlot(null)}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Collapsible: All appointments list */}
      <div style={{ marginTop: '2rem' }}>
        <button
          type="button"
          className="btn secondary"
          style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
          onClick={() => setShowAllAppointments((v) => !v)}
        >
          <span>📋 כל התורים שנקבעו במערכת ({appointments.filter((a) => a.status !== 'cancelled').length})</span>
          <span>{showAllAppointments ? '▲ הסתר' : '▼ הצג'}</span>
        </button>

        {showAllAppointments ? (
          <div className="panel" style={{ marginTop: '0.75rem' }}>
            <div className="admin-table">
              {appointments
                .slice()
                .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
                .map((item) => (
                  <article key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', alignItems: 'center', gap: '0.75rem' }}>
                    <div>
                      <strong>{item.serviceName} · {item.customerName}</strong>
                      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                        {item.date} בשעה {item.time} {item.therapist ? `· ${item.therapist}` : ''}
                      </p>
                    </div>
                    <div className="split-fields" style={{ margin: 0 }}>
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
                      className="text-btn danger"
                      onClick={() => {
                        if (!window.confirm('למחוק את התור לצמיתות?')) return
                        void adminFetch(`/api/admin/appointments/${item.id}`, { method: 'DELETE' }).catch((reason) => setError(serviceSaveError(reason)))
                      }}
                    >
                      מחיקה
                    </button>
                  </article>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type ShopCategory = {
  id: string
  name: string
  blurb: string
  sort?: number
  image?: string
  active?: boolean
}

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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ShopCategory | null>(null)
  const [name, setName] = useState('')
  const [blurb, setBlurb] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [active, setActive] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    return watchAdminCategories(
      (rows) => {
        setCategories(rows as ShopCategory[])
        setLoading(false)
      },
      (reason) => {
        console.error(reason)
        setError('לא הצלחנו לטעון את הקטגוריות. נסו שוב.')
        setLoading(false)
      },
    )
  }, [])

  function openCreateForm() {
    setEditingCategory(null)
    setName('')
    setBlurb('')
    setSortOrder(categories.length > 0 ? Math.max(...categories.map((c) => c.sort || 0)) + 1 : 1)
    setImageUrl('')
    setActive(true)
    setError('')
    setMessage('')
    setShowForm(true)
  }

  function openEditForm(cat: ShopCategory) {
    setEditingCategory(cat)
    setName(cat.name)
    setBlurb(cat.blurb || '')
    setSortOrder(cat.sort ?? 0)
    setImageUrl(cat.image || '')
    setActive(cat.active !== false)
    setError('')
    setMessage('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await adminFetch<{ url: string }>('/api/admin/upload', {
        method: 'POST',
        body: fd,
      })
      setImageUrl(res.url)
      setMessage('תמונת הקטגוריה הועלתה בהצלחה!')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'העלאת התמונה נכשלה')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('חסר שם קטגוריה')
      return
    }
    setError('')
    setMessage('')
    setSaving(true)
    try {
      if (editingCategory) {
        await adminFetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nextName,
            blurb: blurb.trim(),
            sort: Number(sortOrder) || 0,
            image: imageUrl.trim(),
            active,
          }),
        })
        setMessage('הקטגוריה עודכנה בהצלחה!')
      } else {
        await adminFetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nextName,
            blurb: blurb.trim(),
            sort: Number(sortOrder) || 0,
            image: imageUrl.trim(),
            active,
          }),
        })
        setMessage('הקטגוריה נוספה בהצלחה!')
      }
      setShowForm(false)
      setEditingCategory(null)
      await snapshotAdminCatalog()
    } catch (reason) {
      setError(categoryFormError(reason))
    } finally {
      setSaving(false)
    }
  }

  async function moveCategory(cat: ShopCategory, direction: 'up' | 'down') {
    const sorted = [...categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    const index = sorted.findIndex((c) => c.id === cat.id)
    if (index === -1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sorted.length) return

    const targetCat = sorted[targetIndex]
    const currentSort = cat.sort ?? index
    const targetSort = targetCat.sort ?? targetIndex

    // If both have identical sort, adjust with offset
    const newCurrentSort = currentSort === targetSort ? (direction === 'up' ? targetSort - 1 : targetSort + 1) : targetSort
    const newTargetSort = currentSort

    try {
      await Promise.all([
        adminFetch(`/api/admin/categories/${cat.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort: newCurrentSort }),
        }),
        adminFetch(`/api/admin/categories/${targetCat.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort: newTargetSort }),
        }),
      ])
      await snapshotAdminCatalog()
    } catch (reason) {
      setError(categoryFormError(reason))
    }
  }

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <h1>קטגוריות</h1>
          <p className="muted">ניהול קטגוריות החנות, סידור סדר הופעה באתר, והעלאת תמונות קטגוריה</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (showForm) {
              setShowForm(false)
              setEditingCategory(null)
            } else {
              openCreateForm()
            }
          }}
        >
          {showForm ? '✕ סגור טופס' : '+ קטגוריה חדשה'}
        </button>
      </div>

      {message ? <div className="admin-banner-notice">{message}</div> : null}
      {error ? <div className="admin-banner-error">{error}</div> : null}

      {/* Add / Edit Form */}
      {showForm ? (
        <form className="panel form" onSubmit={handleSave} style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '2px solid #005a9c' }}>
          <h3>{editingCategory ? `עריכת קטגוריה: ${editingCategory.name}` : 'הוספת קטגוריה חדשה'}</h3>
          
          <div className="split-fields">
            <label>
              שם הקטגוריה
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: אורתופדיה, מדרסים"
                required
              />
            </label>
            <label>
              סדר תצוגה (מספר נמוך מופיע ראשון)
              <input
                name="sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </label>
          </div>

          <label>
            תיאור קצר
            <input
              name="blurb"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="תיאור קצר של הקטגוריה ומוצריה"
            />
          </label>

          {/* Image Upload & Preview */}
          <div style={{ margin: '0.75rem 0', padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              תמונת קטגוריה (מוצגת כעיגול בדף הבית ובחנות)
            </span>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: '3px solid #005a9c',
                  overflow: 'hidden',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.8rem' }}>📁</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label className="btn secondary small" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: '0.5rem' }}>
                  {uploading ? 'מעלה תמונה...' : '📷 העלאת תמונה מהמחשב'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
                <input
                  type="text"
                  placeholder="או הדביקו קישור לתמונה (URL)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <label className="check-line">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            קטגוריה פעילה ומוצגת בחנות
          </label>

          <div className="choice-row" style={{ marginTop: '1rem' }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'שומר...' : editingCategory ? 'עדכן קטגוריה ✓' : 'שמור קטגוריה חדשה ✓'}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingCategory(null)
              }}
            >
              ביטול
            </button>
          </div>
        </form>
      ) : null}

      {/* Category List */}
      {loading ? <p className="muted">טוען קטגוריות...</p> : null}
      {!loading && !error && categories.length === 0 ? <p>עדיין אין קטגוריות.</p> : null}

      <div className="admin-table">
        {categories.map((category, idx) => (
          <article
            key={category.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1.5fr 110px 90px auto',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '0.5rem',
              background: 'white',
            }}
          >
            {/* Category Avatar */}
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '2px solid #e2e8f0',
                overflow: 'hidden',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              {category.image ? (
                <img src={category.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.4rem' }}>📁</span>
              )}
            </div>

            {/* Name & Blurb */}
            <div>
              <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{category.name}</strong>
              <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem' }}>
                {category.blurb || 'ללא תיאור'}
              </p>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>מזהה: {category.id}</span>
            </div>

            {/* Reorder Arrows */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn secondary small"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                title="הזז למעלה"
                disabled={idx === 0}
                onClick={() => moveCategory(category, 'up')}
              >
                ▲
              </button>
              <button
                type="button"
                className="btn secondary small"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                title="הזז למטה"
                disabled={idx === categories.length - 1}
                onClick={() => moveCategory(category, 'down')}
              >
                ▼
              </button>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>#{category.sort ?? idx}</span>
            </div>

            {/* Active Status Badge */}
            <div>
              <span className={`badge ${category.active !== false ? 'in-stock' : 'out-of-stock'}`}>
                {category.active !== false ? 'פעיל' : 'מוסתר'}
              </span>
            </div>

            {/* Edit / Delete Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => openEditForm(category)}
              >
                עריכה
              </button>
              <button
                type="button"
                className="btn-danger small"
                onClick={() => {
                  if (!window.confirm(`למחוק את הקטגוריה "${category.name}"? מוצרים המשויכים אליה לא יימחקו.`)) return
                  void adminFetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' })
                    .then(() => snapshotAdminCatalog())
                    .then(() => setMessage('הקטגוריה נמחקה בהצלחה'))
                    .catch((reason) => setError(categoryFormError(reason)))
                }}
              >
                מחיקה
              </button>
            </div>
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

function formatHebrewDateWithDay(dateStr: string) {
  if (!dateStr) return { formatted: '', dayName: '' }
  const d = new Date(`${dateStr}T12:00:00`)
  const dayName = DAY[d.getDay()] || ''
  const parts = dateStr.split('-')
  const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr
  return { formatted, dayName }
}

export function AdminEmployees() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedEmployeeId = searchParams.get('id') || null
  const [month, setMonth] = useState(() => searchParams.get('month') || new Date().toISOString().slice(0, 7))
  const [employees, setEmployees] = useState<StaffCard[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Create new employee modal / state
  const [showCreateEmployee, setShowCreateEmployee] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createPayMode, setCreatePayMode] = useState<'hour' | 'global'>('hour')
  const [createHourlyRate, setCreateHourlyRate] = useState<number>(35)
  const [createGlobalPay, setCreateGlobalPay] = useState<number>(6000)
  const [createSaving, setCreateSaving] = useState(false)

  // Edit employee credentials state
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editCredentialsSaving, setEditCredentialsSaving] = useState(false)

  // Edit pay mode & rates state
  const [payMode, setPayMode] = useState<'hour' | 'global'>('hour')
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [globalPay, setGlobalPay] = useState<number>(0)
  const [paySaving, setPaySaving] = useState(false)

  // Manual shift add state
  const [showAddShift, setShowAddShift] = useState(false)
  const [shiftDate, setShiftDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [shiftInTime, setShiftInTime] = useState('09:00')
  const [shiftOutTime, setShiftOutTime] = useState('17:00')
  const [shiftNote, setShiftNote] = useState('הזנת מנהל')
  const [shiftSaving, setShiftSaving] = useState(false)

  // Edit single punch modal state
  const [editingPunch, setEditingPunch] = useState<{ id: string; at: string; note: string; kind: string } | null>(null)
  const [editPunchDate, setEditPunchDate] = useState('')
  const [editPunchTime, setEditPunchTime] = useState('')
  const [editPunchNote, setEditPunchNote] = useState('')
  const [editPunchSaving, setEditPunchSaving] = useState(false)

  async function load(nextMonth = month) {
    setLoading(true)
    try {
      const data = await adminFetch<{ employees: StaffCard[]; corrections: Correction[] }>(`/api/admin/attendance?month=${nextMonth}`)
      setEmployees(Array.isArray(data.employees) ? data.employees : [])
      setCorrections(Array.isArray(data.corrections) ? data.corrections : [])
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון עובדים ונוכחות')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(month)
  }, [month])

  // Sync edit forms when selectedEmployee changes
  const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId) || null

  useEffect(() => {
    if (selectedEmployee) {
      setEditName(selectedEmployee.name)
      setEditUsername(selectedEmployee.username)
      setEditPassword('')
      setEditActive(selectedEmployee.active !== false)
      setPayMode(selectedEmployee.payMode || 'hour')
      setHourlyRate(selectedEmployee.hourlyRate || 0)
      setGlobalPay(selectedEmployee.globalPay || 0)
    }
  }, [selectedEmployee?.id, selectedEmployee?.name, selectedEmployee?.username, selectedEmployee?.payMode, selectedEmployee?.hourlyRate, selectedEmployee?.globalPay, selectedEmployee?.active])

  function selectEmployee(empId: string | null) {
    if (empId) {
      setSearchParams({ id: empId, month })
    } else {
      setSearchParams(month ? { month } : {})
    }
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCreateEmployee(e: FormEvent) {
    e.preventDefault()
    if (!createName.trim() || !createUsername.trim() || !createPassword.trim()) {
      setError('חובה למלא שם, שם משתמש וסיסמה ראשונית')
      return
    }
    if (createPassword.length < 6) {
      setError('הסיסמה צריכה להכיל לפחות 6 תווים')
      return
    }
    setCreateSaving(true)
    setError('')
    try {
      await adminFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          username: createUsername.trim().toLowerCase(),
          password: createPassword,
          payMode: createPayMode,
          hourlyRate: Number(createHourlyRate) || 0,
          globalPay: Number(createGlobalPay) || 0,
        }),
      })
      setNotice(`העובד/ת ${createName.trim()} נוסף/ה בהצלחה!`)
      setShowCreateEmployee(false)
      setCreateName('')
      setCreateUsername('')
      setCreatePassword('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'הוספת העובד נכשלה')
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleSaveCredentials(e: FormEvent) {
    e.preventDefault()
    if (!selectedEmployee) return
    if (!editName.trim() || !editUsername.trim()) {
      setError('חובה למלא שם ושם משתמש')
      return
    }
    if (editPassword && editPassword.length < 6) {
      setError('הסיסמה החדשה צריכה להכיל לפחות 6 תווים')
      return
    }
    setEditCredentialsSaving(true)
    setError('')
    try {
      await adminFetch(`/api/admin/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          username: editUsername.trim().toLowerCase(),
          password: editPassword ? editPassword : undefined,
          active: editActive,
        }),
      })
      setNotice('פרטי העובד, שם המשתמש והסיסמה עודכנו בהצלחה!')
      setEditPassword('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'עדכון פרטי העובד נכשל')
    } finally {
      setEditCredentialsSaving(false)
    }
  }

  async function handleSavePay(e: FormEvent) {
    e.preventDefault()
    if (!selectedEmployee) return
    setPaySaving(true)
    setError('')
    try {
      await adminFetch(`/api/admin/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payMode,
          hourlyRate: Number(hourlyRate) || 0,
          globalPay: Number(globalPay) || 0,
        }),
      })
      setNotice('הגדרות השכר עודכנו והמשכורת חושבה מחדש בהצלחה!')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'עדכון השכר נכשל')
    } finally {
      setPaySaving(false)
    }
  }

  async function handleAddShift(e: FormEvent) {
    e.preventDefault()
    if (!selectedEmployee) return
    if (!shiftDate || !shiftInTime || !shiftOutTime) {
      setError('חובה לבחור תאריך ושעות כניסה ויציאה')
      return
    }
    setShiftSaving(true)
    setError('')
    try {
      await adminFetch('/api/admin/attendance/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
          date: shiftDate,
          inTime: shiftInTime,
          outTime: shiftOutTime,
          note: shiftNote.trim() || 'הזנת מנהל',
        }),
      })
      setNotice('משמרת נוספה בהצלחה!')
      setShowAddShift(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'הוספת המשמרת נכשלה')
    } finally {
      setShiftSaving(false)
    }
  }

  async function handleClockOutOpenShift() {
    if (!selectedEmployee) return
    setError('')
    try {
      await adminFetch('/api/admin/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
          kind: 'out',
          at: new Date().toISOString(),
          note: 'סגירת משמרת ע״י מנהל',
        }),
      })
      setNotice('המשמרת נסגרה בהצלחה!')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'סגירת המשמרת נכשלה')
    }
  }

  function openEditPunchModal(punch: { id: string; at: string; note: string; kind: string }) {
    const d = new Date(punch.at)
    setEditingPunch(punch)
    setEditPunchDate(d.toLocaleDateString('en-CA'))
    setEditPunchTime(d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
    setEditPunchNote(punch.note || '')
  }

  async function handleSaveEditedPunch(e: FormEvent) {
    e.preventDefault()
    if (!editingPunch || !editPunchDate || !editPunchTime) return
    setEditPunchSaving(true)
    setError('')
    try {
      const iso = new Date(`${editPunchDate}T${editPunchTime}:00+03:00`).toISOString()
      await adminFetch(`/api/admin/attendance/punch/${editingPunch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          at: iso,
          note: editPunchNote.trim(),
        }),
      })
      setNotice('שעת הדיווח עודכנה בהצלחה!')
      setEditingPunch(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'עדכון הדיווח נכשל')
    } finally {
      setEditPunchSaving(false)
    }
  }

  async function handleDeletePunch(punchId: string) {
    if (!window.confirm('למחוק דיווח זה לצמיתות? שעות המשמרת יחושבו מחדש.')) return
    setError('')
    try {
      await adminFetch(`/api/admin/attendance/punch/${punchId}`, {
        method: 'DELETE',
      })
      setNotice('הדיווח נמחק בהצלחה')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'מחיקת הדיווח נכשלה')
    }
  }

  const pendingCorrections = corrections.filter((c) => c.status === 'pending')

  return (
    <div className="admin-staff-unified">
      {notice ? <div className="admin-banner-notice">{notice}</div> : null}
      {error ? <div className="admin-banner-error">{error}</div> : null}

      {/* ========================================================= */}
      {/* 1. MAIN OVERVIEW: Only employees with primary details     */}
      {/* ========================================================= */}
      {!selectedEmployee ? (
        <div>
          <div className="admin-header-row">
            <div>
              <h1>עובדים ונוכחות</h1>
              <p className="muted">ניהול צוות העובדים, חשבונות כניסה, מעקב נוכחות וחישוב שכר</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="month-pick" style={{ margin: 0 }}>
                חודש:
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value)
                    setSearchParams({ month: e.target.value })
                  }}
                  style={{ marginRight: '0.4rem' }}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => setShowCreateEmployee((v) => !v)}
              >
                {showCreateEmployee ? '✕ סגור טופס' : '+ עובד חדש'}
              </button>
            </div>
          </div>

          {/* Pending corrections alert across employees */}
          {pendingCorrections.length > 0 ? (
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>⚠️ ממתינות {pendingCorrections.length} בקשות תיקון שעות מעובדים לאישור</span>
              <span style={{ fontSize: '0.85rem' }}>לחצו על שם העובד לצפייה ואישור</span>
            </div>
          ) : null}

          {/* Create Employee Modal / Form */}
          {showCreateEmployee ? (
            <form
              className="panel form"
              onSubmit={handleCreateEmployee}
              style={{
                marginBottom: '1.5rem',
                background: '#f8fafc',
                border: '2px solid #005a9c',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.85rem 0', color: '#005a9c' }}>הוספת עובד/ת חדש/ה למערכת</h3>
              <p className="muted" style={{ margin: '0 0 1rem 0', fontSize: '0.88rem' }}>
                העובד יקבל שם משתמש וסיסמה שבאמצעותם יוכל להתחבר לאזור האישי ולדווח כניסה/יציאה מהנייד.
              </p>

              <div className="split-fields">
                <label>
                  שם מלא של העובד
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="למשל: דנה לוי"
                    required
                  />
                </label>
                <label>
                  שם משתמש באנגלית (להתחברות)
                  <input
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                    placeholder="למשל: dana"
                    dir="ltr"
                    required
                  />
                </label>
              </div>

              <div className="split-fields">
                <label>
                  סיסמה ראשונית (לפחות 6 תווים)
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    dir="ltr"
                    required
                  />
                </label>
                <label>
                  אופן תשלום שכר
                  <select
                    value={createPayMode}
                    onChange={(e) => setCreatePayMode(e.target.value as 'hour' | 'global')}
                  >
                    <option value="hour">לפי שעה (שעתי)</option>
                    <option value="global">גלובלי לחודש</option>
                  </select>
                </label>
              </div>

              <div className="split-fields">
                {createPayMode === 'hour' ? (
                  <label>
                    תעריף שעתי ₪
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={createHourlyRate}
                      onChange={(e) => setCreateHourlyRate(Number(e.target.value))}
                      required
                    />
                  </label>
                ) : (
                  <label>
                    סכום גלובלי חודשי ₪
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={createGlobalPay}
                      onChange={(e) => setCreateGlobalPay(Number(e.target.value))}
                      required
                    />
                  </label>
                )}
              </div>

              <div className="choice-row" style={{ marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={createSaving}>
                  {createSaving ? 'יוצר עובד...' : 'הוספת עובד חדש ✓'}
                </button>
                <button className="btn secondary" type="button" onClick={() => setShowCreateEmployee(false)}>
                  ביטול
                </button>
              </div>
            </form>
          ) : null}

          {/* Loading state */}
          {loading ? <p className="muted">טוען עובדים ונתוני נוכחות...</p> : null}

          {/* Empty state */}
          {!loading && employees.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>עדיין אין עובדים במערכת.</p>
              <p className="muted">לחצו על כפתור &quot;+ עובד חדש&quot; כדי לפתוח כרטיס עובד ראשון.</p>
            </div>
          ) : null}

          {/* Employees List with Primary Details */}
          <div className="admin-employee-cards-grid">
            {employees.map((employee) => {
              const hasOpenShift = Boolean(employee.openShift)
              const hasPending = corrections.some((c) => c.employeeName === employee.name && c.status === 'pending')

              return (
                <div
                  key={employee.id}
                  className="admin-employee-card"
                  onClick={() => selectEmployee(employee.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="employee-card-header">
                    <div>
                      <strong className="employee-name-title">{employee.name}</strong>
                      <span className="employee-username-tag">@{employee.username}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${employee.active !== false ? 'in-stock' : 'out-of-stock'}`}>
                        {employee.active !== false ? 'פעיל' : 'מושבת'}
                      </span>
                      {hasPending ? <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>בקשת תיקון ⚠️</span> : null}
                    </div>
                  </div>

                  {/* Presence indicator */}
                  <div className="employee-presence-row">
                    {hasOpenShift ? (
                      <span className="presence-chip active">
                        🟢 בעבודה כרגע (משמרת מ־{new Date(employee.openShift!.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    ) : (
                      <span className="presence-chip idle">
                        ⚪ לא במשמרת כרגע
                      </span>
                    )}
                  </div>

                  {/* Primary Summary Metrics for selected month */}
                  <div className="employee-summary-metrics">
                    <div className="metric-box">
                      <span className="metric-label">אופן תשלום</span>
                      <strong className="metric-val">
                        {employee.payMode === 'global' ? `גלובלי (${money(employee.globalPay)})` : `שעתי (${money(employee.hourlyRate)})`}
                      </strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">סה״כ שעות החודש</span>
                      <strong className="metric-val" style={{ color: '#0369a1' }}>
                        {hoursLabel(employee.totalMinutes)} שעות ({employee.days.length} ימים)
                      </strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">שכר מחושב</span>
                      <strong className="metric-val" style={{ color: '#059669', fontSize: '1.05rem' }}>
                        {money(employee.salary)}
                      </strong>
                    </div>
                  </div>

                  {/* Open action button */}
                  <div className="employee-card-footer">
                    <span className="employee-open-link">
                      ניהול עובד, נוכחות ושכר ⟵
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* 2. EMPLOYEE DETAIL VIEW: Account, Table & Salary Calc    */
        /* ========================================================= */
        <div className="admin-employee-detail-view">
          {/* Top Bar with Back Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => selectEmployee(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            >
              <span>← חזרה לרשימת כל העובדים</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`badge ${selectedEmployee.active !== false ? 'in-stock' : 'out-of-stock'}`}>
                {selectedEmployee.active !== false ? 'חשבון פעיל' : 'חשבון מושבת'}
              </span>
              <button
                type="button"
                className="btn-danger small"
                onClick={() => {
                  if (!window.confirm(`למחוק את העובד ${selectedEmployee.name} לצמיתות מהמערכת?`)) return
                  void adminFetch(`/api/admin/employees/${selectedEmployee.id}`, { method: 'DELETE' })
                    .then(() => {
                      setNotice('העובד נמחק מהמערכת')
                      selectEmployee(null)
                      return load()
                    })
                    .catch((reason) => setError(reason instanceof Error ? reason.message : 'המחיקה נכשלה'))
                }}
              >
                מחיקת עובד ✕
              </button>
            </div>
          </div>

          {/* Employee Header */}
          <div className="panel" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#0f172a' }}>{selectedEmployee.name}</h1>
                <p className="muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
                  שם משתמש: <strong>@{selectedEmployee.username}</strong> · מזהה: {selectedEmployee.id}
                </p>
              </div>
              <div style={{ textAlign: 'left', minWidth: '180px' }}>
                <span className="muted" style={{ fontSize: '0.82rem', display: 'block' }}>שכר מחושב לחודש {month}:</span>
                <strong style={{ fontSize: '1.4rem', color: '#059669', display: 'block' }}>{money(selectedEmployee.salary)}</strong>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>({hoursLabel(selectedEmployee.totalMinutes)} שעות עבודה)</span>
              </div>
            </div>

            {/* Open shift indicator on detail view */}
            {selectedEmployee.openShift ? (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>
                    ⏳ משמרת פתוחה כרגע משעה {new Date(selectedEmployee.openShift.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="muted" style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem' }}>
                    העובד דיווח כניסה ב־{new Date(selectedEmployee.openShift.at).toLocaleString('he-IL')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-danger small"
                  onClick={handleClockOutOpenShift}
                >
                  סגור משמרת עכשיו (יציאה) 🛑
                </button>
              </div>
            ) : null}
          </div>

          {/* Section 1: Account Settings (Username & Password) */}
          <section className="panel" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 0.85rem 0', color: '#005a9c' }}>🔑 הגדרות שם משתמש וסיסמה</h3>
            <form onSubmit={handleSaveCredentials} className="form">
              <div className="split-fields">
                <label>
                  שם מלא
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  שם משתמש באנגלית
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    dir="ltr"
                    required
                  />
                </label>
              </div>
              <div className="split-fields">
                <label>
                  סיסמה חדשה (השאירו ריק כדי לא לשנות)
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="הקלידו לפחות 6 תווים רק אם רוצים להחליף סיסמה"
                    minLength={6}
                    dir="ltr"
                  />
                </label>
                <label className="check-line" style={{ marginTop: '1.8rem' }}>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  חשבון עובד פעיל (יכול להתחבר)
                </label>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button className="btn" type="submit" disabled={editCredentialsSaving}>
                  {editCredentialsSaving ? 'שומר פרטים...' : 'שמור פרטי כניסה וסיסמה ✓'}
                </button>
              </div>
            </form>
          </section>

          {/* Section 2: Attendance Monthly Table by Date */}
          <section className="panel" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a' }}>📅 טבלת נוכחות לפי תאריך לחודש {month}</h3>
                <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                  פירוט כניסה, יציאה וסה״כ שעות עבודה יומיות
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="month-pick" style={{ margin: 0 }}>
                  בחירת חודש:
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value)
                      setSearchParams({ id: selectedEmployee.id, month: e.target.value })
                    }}
                    style={{ marginRight: '0.4rem' }}
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowAddShift((v) => !v)}
                >
                  {showAddShift ? '✕ סגור טופס' : '+ הוספת שעות ידנית'}
                </button>
              </div>
            </div>

            {/* Manual shift form inside employee view */}
            {showAddShift ? (
              <form
                className="panel form"
                onSubmit={handleAddShift}
                style={{
                  marginBottom: '1.25rem',
                  background: '#f8fafc',
                  border: '2px solid #005a9c',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#005a9c' }}>הוספת משמרת או תיקון שעות ידני לעובד זה</h4>
                <div className="split-fields">
                  <label>
                    תאריך המשמרת
                    <input
                      type="date"
                      value={shiftDate}
                      onChange={(e) => setShiftDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    הערה (למשל: שעות נוספות, אישור מנהל)
                    <input
                      value={shiftNote}
                      onChange={(e) => setShiftNote(e.target.value)}
                      placeholder="הזנת מנהל"
                    />
                  </label>
                </div>
                <div className="split-fields">
                  <label>
                    שעת כניסה
                    <input
                      type="time"
                      value={shiftInTime}
                      onChange={(e) => setShiftInTime(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    שעת יציאה
                    <input
                      type="time"
                      value={shiftOutTime}
                      onChange={(e) => setShiftOutTime(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="choice-row" style={{ marginTop: '0.75rem' }}>
                  <button className="btn" type="submit" disabled={shiftSaving}>
                    {shiftSaving ? 'שומר משמרת...' : 'הוסף משמרת לטבלה ✓'}
                  </button>
                  <button className="btn secondary" type="button" onClick={() => setShowAddShift(false)}>
                    ביטול
                  </button>
                </div>
              </form>
            ) : null}

            {/* Full Monthly Table by Date */}
            {selectedEmployee.days.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <p className="muted" style={{ margin: '0 0 0.5rem 0' }}>לא נרשמו דיווחי נוכחות סגורים בחודש {month}.</p>
                <button type="button" className="btn secondary small" onClick={() => setShowAddShift(true)}>
                  + הוסף משמרת ראשונה לחודש זה
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-attendance-table">
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>תאריך ויום</th>
                      <th style={{ width: '130px' }}>שעת כניסה</th>
                      <th style={{ width: '130px' }}>שעת יציאה</th>
                      <th style={{ width: '140px' }}>סה״כ זמן ליום</th>
                      <th>הערות דיווח</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployee.days.map((day) => {
                      const { formatted, dayName } = formatHebrewDateWithDay(day.date)
                      const isMultiShift = day.shifts.length > 1
                      const inTimes = day.shifts.map((s) => new Date(s.inAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })).join(', ')
                      const outTimes = day.shifts.map((s) => new Date(s.outAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })).join(', ')

                      // Find notes for this day from raw history punches
                      const notes = (selectedEmployee.history || [])
                        .filter((h) => h.at && h.at.startsWith(day.date) && h.note)
                        .map((h) => h.note)

                      return (
                        <tr key={day.date}>
                          <td>
                            <strong>{formatted}</strong>
                            <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>יום {dayName}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#166534' }}>{inTimes}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#991b1b' }}>{outTimes}</span>
                          </td>
                          <td>
                            <strong style={{ color: '#0369a1', fontSize: '1rem' }}>
                              {hoursLabel(day.minutes)} שעות
                            </strong>
                            {isMultiShift ? (
                              <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                                ({day.shifts.length} משמרות)
                              </span>
                            ) : null}
                          </td>
                          <td>
                            {notes.length > 0 ? (
                              <span style={{ fontSize: '0.85rem' }}>{notes.join(' · ')}</span>
                            ) : (
                              <span className="muted" style={{ fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', fontWeight: 800, fontSize: '1.05rem' }}>
                      <td>
                        סה״כ חודשי ({selectedEmployee.days.length} ימי עבודה)
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td style={{ color: '#005a9c' }}>
                        {hoursLabel(selectedEmployee.totalMinutes)} שעות
                      </td>
                      <td>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Section 3: UNDER THE TABLE - Pay Settings & Salary Calculator */}
          <section className="panel" style={{ padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', background: '#ffffff', border: '2px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.2rem' }}>
              💰 עדכון שכר וחישוב משכורת חודשית
            </h3>

            {/* Pay settings form */}
            <form onSubmit={handleSavePay} className="form" style={{ marginBottom: '1.5rem' }}>
              <div className="split-fields">
                <label>
                  אופן תשלום השכר
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as 'hour' | 'global')}
                  >
                    <option value="hour">לפי שעה (שעתי)</option>
                    <option value="global">גלובלי לחודש (סכום קבוע)</option>
                  </select>
                </label>
                {payMode === 'hour' ? (
                  <label>
                    תעריף לשעה ₪
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      required
                    />
                  </label>
                ) : (
                  <label>
                    סכום שכר גלובלי לחודש ₪
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={globalPay}
                      onChange={(e) => setGlobalPay(Number(e.target.value))}
                      required
                    />
                  </label>
                )}
              </div>
              <div>
                <button className="btn secondary" type="submit" disabled={paySaving}>
                  {paySaving ? 'מעדכן שכר...' : 'עדכן תעריף שכר ✓'}
                </button>
              </div>
            </form>

            {/* Immediate Calculated Salary Display Box */}
            <div
              style={{
                background: '#ecfdf5',
                border: '2px solid #10b981',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: 600, display: 'block' }}>
                  פירוט חישוב משכורת לחודש {month}:
                </span>
                {selectedEmployee.payMode === 'global' ? (
                  <p style={{ margin: '0.35rem 0 0 0', color: '#047857', fontSize: '1rem' }}>
                    שכר גלובלי חודשי מוגדר: <strong>{money(selectedEmployee.globalPay)}</strong>
                    <span className="muted" style={{ marginRight: '0.5rem', fontSize: '0.85rem' }}>
                      (סה״כ ביצע בחודש זה {hoursLabel(selectedEmployee.totalMinutes)} שעות עבודה)
                    </span>
                  </p>
                ) : (
                  <p style={{ margin: '0.35rem 0 0 0', color: '#047857', fontSize: '1rem' }}>
                    סה״כ שעות: <strong>{hoursLabel(selectedEmployee.totalMinutes)}</strong> ({((selectedEmployee.totalMinutes || 0) / 60).toFixed(2)} שעות)
                    {' × '}
                    תעריף: <strong>{money(selectedEmployee.hourlyRate)}/שעה</strong>
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'left', minWidth: '220px' }}>
                <span style={{ fontSize: '0.85rem', color: '#047857', display: 'block', fontWeight: 600 }}>
                  סך המשכורת לתשלום:
                </span>
                <span style={{ fontSize: '2.1rem', fontWeight: 900, color: '#065f46', lineHeight: 1.1 }}>
                  {money(selectedEmployee.salary)}
                </span>
              </div>
            </div>
          </section>

          {/* Section 4: Raw punch logs & History (for editing punch times) */}
          <section className="panel" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>
              📋 היסטוריית דיווחים פרטנית (תיקון ועריכת שעות)
            </h4>
            <p className="muted" style={{ margin: '0 0 0.85rem 0', fontSize: '0.82rem' }}>
              כאן ניתן לתקן שעת כניסה/יציאה ספציפית או למחוק דיווח שגוי
            </p>

            {(selectedEmployee.history || []).length === 0 ? (
              <p className="muted">אין דיווחים בודדים בחודש זה.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {(selectedEmployee.history || []).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1.5fr 1fr auto',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'white',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span className={`badge ${item.kind === 'in' ? 'in-stock' : 'out-of-stock'}`} style={{ fontSize: '0.74rem', textAlign: 'center' }}>
                      {item.kind === 'in' ? 'כניסה' : item.kind === 'out' ? 'יציאה' : 'הערה'}
                    </span>
                    <span style={{ fontSize: '0.88rem' }}>{new Date(item.at).toLocaleString('he-IL')}</span>
                    <span className="muted" style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.note || '—'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => openEditPunchModal(item)}
                      >
                        עריכה
                      </button>
                      <button
                        type="button"
                        className="text-btn danger"
                        onClick={() => handleDeletePunch(item.id)}
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 5: Correction requests for this employee */}
          {corrections.filter((c) => c.employeeName === selectedEmployee.name).length > 0 ? (
            <section className="panel" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', background: '#fffbeb', border: '1px solid #fef3c7' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#92400e' }}>
                ⚠️ בקשות לתיקון שעות מעובד זה
              </h4>
              <div className="stack-list">
                {corrections
                  .filter((c) => c.employeeName === selectedEmployee.name)
                  .map((item) => (
                    <article key={item.id} style={{ background: 'white', padding: '0.75rem', borderRadius: '8px' }}>
                      <div>
                        <strong>
                          {item.kind === 'in' ? 'כניסה' : 'יציאה'} · {item.date}
                        </strong>
                        <p className="muted" style={{ margin: '0.2rem 0' }}>{item.note}</p>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          נשלח ב־{new Date(item.requestedAt).toLocaleString('he-IL')}
                        </span>
                      </div>
                      {item.status === 'pending' ? (
                        <div className="choice-row">
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => {
                              void adminFetch(`/api/admin/corrections/${item.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'approved' }),
                              }).then(() => {
                                setNotice('בקשת התיקון אושרה')
                                return load()
                              })
                            }}
                          >
                            אישור תיקון
                          </button>
                          <button
                            className="btn secondary small"
                            type="button"
                            onClick={() => {
                              void adminFetch(`/api/admin/corrections/${item.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'rejected' }),
                              }).then(() => {
                                setNotice('בקשת התיקון נדחתה')
                                return load()
                              })
                            }}
                          >
                            דחייה
                          </button>
                        </div>
                      ) : (
                        <span className={`badge ${item.status === 'approved' ? 'in-stock' : 'out-of-stock'}`}>
                          {item.status === 'approved' ? 'אושר' : 'נדחה'}
                        </span>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          ) : null}

          {/* Edit Single Punch Modal */}
          {editingPunch ? (
            <div className="admin-modal-overlay" onClick={() => setEditingPunch(null)}>
              <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal-header">
                  <h3>תיקון דיווח {editingPunch.kind === 'in' ? 'כניסה' : 'יציאה'}</h3>
                  <button type="button" className="admin-modal-close" onClick={() => setEditingPunch(null)}>
                    ✕
                  </button>
                </div>
                <form onSubmit={handleSaveEditedPunch} className="form" style={{ marginTop: '1rem' }}>
                  <div className="split-fields">
                    <label>
                      תאריך
                      <input
                        type="date"
                        value={editPunchDate}
                        onChange={(e) => setEditPunchDate(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      שעה מדויקת
                      <input
                        type="time"
                        value={editPunchTime}
                        onChange={(e) => setEditPunchTime(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    הערת תיקון
                    <input
                      value={editPunchNote}
                      onChange={(e) => setEditPunchNote(e.target.value)}
                      placeholder="למשל: תוקן לפי אישור מנהל"
                    />
                  </label>
                  <div className="choice-row" style={{ marginTop: '1rem' }}>
                    <button className="btn" type="submit" disabled={editPunchSaving}>
                      {editPunchSaving ? 'שומר...' : 'שמור תיקון שעה ✓'}
                    </button>
                    <button className="btn secondary" type="button" onClick={() => setEditingPunch(null)}>
                      ביטול
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export const AdminStaff = AdminEmployees
