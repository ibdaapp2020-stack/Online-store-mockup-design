import { FormEvent, useState } from 'react'
import { clubGifts } from '../data'
import { money } from '../pricing'
import { useStore } from '../store'

export function Club() {
  const { club, joinClub, claimGift } = useStore()
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [error, setError] = useState('')

  const onJoin = (event: FormEvent) => {
    event.preventDefault()
    const ok = joinClub(form)
    setError(ok ? '' : 'שם, טלפון ואימייל תקינים')
  }

  return (
    <div className="wrap club">
      <p className="kicker">מועדון לקוחות</p>
      <h1>נקודות על כל קנייה, ומתנה בשני ספים.</h1>
      <p className="lead">כל 10 ₪ בקנייה מזכים בנקודה. ב־10,000 ₪ מצטברים נפתחת מתנה, וב־20,000 ₪ נפתחת מתנה שנייה.</p>

      {club ? (
        <>
          <div className="club-board">
            <article>
              <span>שלום {club.name}</span>
              <strong>{club.points}</strong>
              <p>נקודות</p>
            </article>
            <article>
              <span>קניות מצטברות</span>
              <strong>{money(club.spent)}</strong>
              <p>מההצטרפות</p>
            </article>
          </div>
          <div className="gift-grid">
            {clubGifts.map((gift) => {
              const open = club.spent >= gift.spend
              const claimed = club.claimed.includes(gift.id)
              const ratio = Math.min(1, club.spent / gift.spend)
              return (
                <article key={gift.id} className={open ? 'gift open' : 'gift'}>
                  <p className="eyebrow">{gift.title}</p>
                  <h2>{gift.prize}</h2>
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <p className="muted">{money(Math.min(club.spent, gift.spend))} מתוך {money(gift.spend)}</p>
                  {claimed ? (
                    <span className="saving">נרשמה לאיסוף בסניף</span>
                  ) : (
                    <button type="button" className="btn btn-primary" disabled={!open} onClick={() => claimGift(gift.id)}>
                      {open ? 'לרשום את המתנה' : 'עוד לא הגעתם'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <form className="editor" onSubmit={onJoin}>
          <div className="form-grid">
            <label className="field">
              <span>שם</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
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
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" type="submit">
            הצטרפות למועדון
          </button>
        </form>
      )}
    </div>
  )
}
