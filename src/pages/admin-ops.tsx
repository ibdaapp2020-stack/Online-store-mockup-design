import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

export function AdminStaff() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [employees, setEmployees] = useState<StaffCard[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Add shift state
  const [showAddShift, setShowAddShift] = useState(false)
  const [shiftEmpId, setShiftEmpId] = useState('')
  const [shiftDate, setShiftDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [shiftInTime, setShiftInTime] = useState('09:00')
  const [shiftOutTime, setShiftOutTime] = useState('17:00')
  const [shiftNote, setShiftNote] = useState('הזנת מנהל')
  const [shiftSaving, setShiftSaving] = useState(false)

  // Edit punch state
  const [editingPunch, setEditingPunch] = useState<{ id: string; at: string; note: string; kind: string } | null>(null)
  const [editPunchDate, setEditPunchDate] = useState('')
  const [editPunchTime, setEditPunchTime] = useState('')
  const [editPunchNote, setEditPunchNote] = useState('')
  const [editPunchSaving, setEditPunchSaving] = useState(false)

  async function load(nextMonth = month) {
    const data = await adminFetch<{ employees: StaffCard[]; corrections: Correction[] }>(`/api/admin/attendance?month=${nextMonth}`)
    setEmployees(Array.isArray(data.employees) ? data.employees : [])
    setCorrections(Array.isArray(data.corrections) ? data.corrections : [])
  }

  useEffect(() => {
    void load(month).catch((reason) => setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון נוכחות'))
  }, [month])

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
    setNotice('נתוני השכר עודכנו בהצלחה')
    await load()
  }

  async function handleAddShift(e: FormEvent) {
    e.preventDefault()
    if (!shiftEmpId || !shiftDate || !shiftInTime || !shiftOutTime) {
      setError('חובה לבחור עובד, תאריך ושעות כניסה ויציאה')
      return
    }
    setError('')
    setNotice('')
    setShiftSaving(true)
    const emp = employees.find((x) => x.id === shiftEmpId)
    try {
      await adminFetch('/api/admin/attendance/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: shiftEmpId,
          employeeName: emp?.name || '',
          date: shiftDate,
          inTime: shiftInTime,
          outTime: shiftOutTime,
          note: shiftNote.trim() || 'הזנת מנהל',
        }),
      })
      setNotice(`משמרת נוספה בהצלחה עבור ${emp?.name || ''}!`)
      setShowAddShift(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירת המשמרת נכשלה')
    } finally {
      setShiftSaving(false)
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
      setNotice('הדיווח עודכן בהצלחה!')
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

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <h1>נוכחות ושעות עבודה</h1>
          <p className="admin-lede">
            שמות משתמש וסיסמאות נמצאים בלשונית <Link to="/employees">עובדים</Link>. כאן רואים משמרות, מתקנים שעות ומחשבים שכר.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!shiftEmpId && employees.length > 0) setShiftEmpId(employees[0].id)
            setShowAddShift((v) => !v)
          }}
        >
          {showAddShift ? '✕ סגור טופס' : '+ הוספת שעות / משמרת ידנית'}
        </button>
      </div>

      {notice ? <div className="admin-banner-notice">{notice}</div> : null}
      {error ? <div className="admin-banner-error">{error}</div> : null}

      {/* Manual Shift Addition Form */}
      {showAddShift ? (
        <form className="panel form" onSubmit={handleAddShift} style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '2px solid #005a9c' }}>
          <h3>הוספת משמרת או תיקון שעות ידני לעובד</h3>
          <label>
            בחירת עובד
            <select
              value={shiftEmpId}
              onChange={(e) => setShiftEmpId(e.target.value)}
              required
            >
              <option value="">-- בחרו עובד --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.username})
                </option>
              ))}
            </select>
          </label>
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
              הערה (למשל: שעות נוספות, תיקון שכחה)
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
          <div className="choice-row" style={{ marginTop: '0.85rem' }}>
            <button className="btn" type="submit" disabled={shiftSaving}>
              {shiftSaving ? 'שומר משמרת...' : 'הוסף משמרת לעובד ✓'}
            </button>
            <button className="btn secondary" type="button" onClick={() => setShowAddShift(false)}>
              ביטול
            </button>
          </div>
        </form>
      ) : null}

      {/* Edit Punch Modal */}
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0' }}>
        <label className="month-pick" style={{ margin: 0 }}>
          בחירת חודש לצפייה וחישוב שכר:
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      <div className="staff-board">
        {employees.map((employee) => (
          <article className="staff-card" key={employee.id}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{employee.name}</strong>
                <span className="muted" style={{ marginRight: '0.5rem' }}>@{employee.username}</span>
              </div>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  setShiftEmpId(employee.id)
                  setShowAddShift(true)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                + שעות לעובד
              </button>
            </header>

            {(employee.days ?? []).length === 0 ? <p className="muted">אין משמרות סגורות בחודש הזה.</p> : null}
            {(employee.days ?? []).map((day) => (
              <div className="day-row" key={day.date}>
                <span>{day.date}</span>
                <span>
                  {day.shifts.map((shift) => `${new Date(shift.inAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}–${new Date(shift.outAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`).join(' · ')}
                </span>
                <strong>{hoursLabel(day.minutes)}</strong>
              </div>
            ))}
            {employee.openShift ? (
              <p style={{ color: '#005a9c', fontWeight: 600 }}>
                ⏳ משמרת פתוחה כרגע מ־{new Date(employee.openShift.at).toLocaleString('he-IL')}
              </p>
            ) : null}
            <div style={{ padding: '0.65rem', background: '#f1f5f9', borderRadius: '6px', margin: '0.75rem 0', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>סה״כ שעות: {hoursLabel(employee.totalMinutes)}</span>
              <span style={{ color: '#059669' }}>שכר מחושב: {money(employee.salary)}</span>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>
              היסטוריית דיווחים (תיקון ומחיקת שעות)
            </h3>
            {(employee.history ?? []).length === 0 ? <p className="muted">אין דיווחים בחודש הזה.</p> : null}
            {(employee.history ?? []).map((item) => (
              <div className="day-row" key={item.id} style={{ display: 'grid', gridTemplateColumns: '70px 1.5fr 1fr auto', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge ${item.kind === 'in' ? 'in-stock' : 'out-of-stock'}`} style={{ fontSize: '0.75rem', textAlign: 'center' }}>
                  {item.kind === 'in' ? 'כניסה' : item.kind === 'out' ? 'יציאה' : 'הערה'}
                </span>
                <span style={{ fontSize: '0.85rem' }}>{new Date(item.at).toLocaleString('he-IL')}</span>
                <span className="muted" style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.note || '—'}
                </span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="text-btn"
                    title="ערוך שעת דיווח זו"
                    onClick={() => openEditPunchModal(item)}
                  >
                    עריכה
                  </button>
                  <button
                    type="button"
                    className="text-btn danger"
                    title="מחק דיווח שגוי זה"
                    onClick={() => handleDeletePunch(item.id)}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}

            <form
              className="split-fields"
              style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}
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
                שמור תעריף
              </button>
            </form>
            <button
              type="button"
              className="text-btn danger"
              style={{ marginTop: '0.5rem' }}
              onClick={() => {
                if (!window.confirm('למחוק את העובד?')) return
                void adminFetch(`/api/admin/employees/${employee.id}`, { method: 'DELETE' }).then(() => load())
              }}
            >
              מחיקת עובד מהמערכת
            </button>
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: '2rem' }}>בקשות תיקון שעות מעובדים</h2>
      <div className="stack-list">
        {corrections.length === 0 ? <p className="muted">אין בקשות תיקון כרגע.</p> : null}
        {corrections.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.employeeName} · {item.kind === 'in' ? 'כניסה' : 'יציאה'} · {item.date}
              </strong>
              <p className="muted">{item.note}</p>
              <p style={{ fontSize: '0.8rem' }}>נשלחה ב־{new Date(item.requestedAt).toLocaleString('he-IL')}</p>
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
                    }).then(() => {
                      setNotice('בקשת התיקון אושרה')
                      return load()
                    })
                  }}
                >
                  אישור תיקון
                </button>
                <button
                  className="btn secondary"
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
    </div>
  )
}

type EmployeeAccount = { id: string; name: string; username: string; authUid?: string; active?: boolean }

export function AdminEmployees() {
  const [employees, setEmployees] = useState<EmployeeAccount[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const data = await adminFetch<EmployeeAccount[]>('/api/admin/employees')
    setEmployees(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון עובדים'))
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await adminFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          username: form.get('username'),
          password: form.get('password'),
        }),
      })
      formElement.reset()
      setNotice('העובד נוסף ויכול להיכנס לאתר עם שם המשתמש והסיסמה.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
    }
  }

  async function save(employee: EmployeeAccount, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (!employee.authUid && password.length < 6) {
      setError('צריך להגדיר סיסמה כדי שהעובד יוכל להיכנס')
      return
    }
    try {
      await adminFetch(`/api/admin/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          username: form.get('username'),
          password: form.get('password'),
        }),
      })
      setNotice(`פרטי הכניסה של ${String(form.get('name') || employee.name)} נשמרו.`)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שמירה נכשלה')
    }
  }

  return (
    <div>
      <h1>עובדים</h1>
      <p className="admin-lede">לכל עובד יש שם משתמש וסיסמה משלו. איתם נכנסים לאתר ומגיעים למסך הנוכחות. הסיסמה לא מוצגת שוב אחרי השמירה.</p>
      <form className="panel employee-form" onSubmit={create}>
        <label>
          שם
          <input name="name" required />
        </label>
        <label>
          שם משתמש באנגלית
          <input name="username" required autoComplete="off" dir="ltr" />
        </label>
        <label>
          סיסמה
          <input name="password" type="password" minLength={6} required autoComplete="new-password" dir="ltr" />
        </label>
        <button className="btn" type="submit">
          הוספת עובד
        </button>
      </form>
      {error ? <p className="form-errors">{error}</p> : null}
      {notice ? <p className="profile-note">{notice}</p> : null}
      <div className="employee-board">
        {employees.length === 0 ? <p className="muted">עדיין אין עובדים.</p> : null}
        {employees.map((employee) => (
          <form className="employee-row" key={`${employee.id}-${employee.username}`} onSubmit={(event) => void save(employee, event)}>
            <label>
              שם
              <input name="name" defaultValue={employee.name} required />
            </label>
            <label>
              שם משתמש
              <input name="username" defaultValue={employee.username} required autoComplete="off" dir="ltr" />
            </label>
            <label>
              סיסמה חדשה
              <input name="password" type="password" minLength={6} placeholder={employee.authUid ? 'השאירו ריק כדי לא לשנות' : 'חובה להגדיר סיסמה'} autoComplete="new-password" dir="ltr" />
            </label>
            <div className="employee-actions">
              <span className="muted">{employee.authUid ? 'יש כניסה' : 'אין כניסה'}</span>
              <button className="btn" type="submit">
                שמירה
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  if (!window.confirm(`למחוק את ${employee.name}?`)) return
                  void adminFetch(`/api/admin/employees/${employee.id}`, { method: 'DELETE' })
                    .then(() => load())
                    .catch((reason) => setError(reason instanceof Error ? reason.message : 'המחיקה נכשלה'))
                }}
              >
                מחיקה
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
