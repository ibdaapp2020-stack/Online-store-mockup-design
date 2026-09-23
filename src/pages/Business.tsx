import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'

export function BusinessAccess() {
  const { businessUser, registerBusiness, loginBusiness, logoutBusiness } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [message, setMessage] = useState('')
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)
  const [form, setForm] = useState({ company: '', hp: '', contact: '', phone: '', email: '', password: '' })

  const onRegister = (event: FormEvent) => {
    event.preventDefault()
    const result = registerBusiness({
      company: form.company,
      hp: form.hp,
      contact: form.contact,
      phone: form.phone,
      email: form.email,
    })
    setMessage(result.message)
    setCreated(result.account ? { username: result.account.username, password: result.account.password } : null)
  }

  const onLogin = (event: FormEvent) => {
    event.preventDefault()
    const ok = loginBusiness(form.email, form.password)
    setMessage(ok ? 'המחירון נפתח' : 'המשתמש או הסיסמה לא נכונים')
    if (ok) setCreated(null)
  }

  if (businessUser && !created) {
    return (
      <div className="wrap b2b">
        <p className="kicker">מחירון עסקי</p>
        <h1>שלום {businessUser.company}</h1>
        <p className="lead">{businessUser.company}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/c/all">
            לקטלוג
          </Link>
          <button type="button" className="btn btn-ghost" onClick={logoutBusiness}>
            יציאה מהמחירון
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap b2b">
      <p className="kicker">לקוחות עסקיים</p>
      <h1>פורטל עסקי</h1>
      <div className="subnav">
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
          הרשמה
        </button>
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
          יש לי משתמש
        </button>
      </div>
      {mode === 'register' ? (
        <form className="editor" onSubmit={onRegister}>
          <div className="form-grid">
            <label className="field">
              <span>שם חברה</span>
              <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
            </label>
            <label className="field">
              <span>ח.פ</span>
              <input value={form.hp} onChange={(event) => setForm({ ...form, hp: event.target.value })} dir="ltr" />
            </label>
            <label className="field">
              <span>איש קשר</span>
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
            </label>
            <label className="field">
              <span>טלפון</span>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} dir="ltr" />
            </label>
            <label className="field wide">
              <span>אימייל</span>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} dir="ltr" />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            הרשמה
          </button>
        </form>
      ) : (
        <form className="editor" onSubmit={onLogin}>
          <div className="form-grid">
            <label className="field">
              <span>אימייל</span>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} dir="ltr" />
            </label>
            <label className="field">
              <span>סיסמה</span>
              <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} dir="ltr" />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            כניסה למחירון
          </button>
        </form>
      )}
      {message && <p className="fine">{message}</p>}
      {created && (
        <div className="thanks-card">
          <p>הפרטים לכניסה:</p>
          <div className="row">
            <span>משתמש</span>
            <b>{created.username}</b>
          </div>
          <div className="row">
            <span>סיסמה</span>
            <b>{created.password}</b>
          </div>
          <Link className="btn btn-primary" to="/shop">
            לחנות
          </Link>
        </div>
      )}
    </div>
  )
}
