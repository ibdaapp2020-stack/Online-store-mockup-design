import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui'
import { useStore } from '../store'

export function Gate() {
  const { audience, setAudience } = useStore()
  const navigate = useNavigate()

  const enter = (next: 'private' | 'business') => {
    setAudience(next)
    navigate('/shop')
  }

  return (
    <div className="gate">
      <div className="brandbar" />
      <header className="gate-top">
        <div className="logo-lock">
          <Logo light />
          <small>עיר הגאדג׳טים</small>
        </div>
        <div className="gate-actions">
          {audience && (
            <button type="button" className="btn btn-yellow" onClick={() => navigate('/shop')}>
              המשך לחנות
            </button>
          )}
          <Link className="text-link" to="/admin">
            ניהול
          </Link>
        </div>
      </header>
      <div className="gate-intro wrap">
        <p className="kicker">הכניסה מפצלת את המחיר</p>
        <h1>לאן נכנסים היום?</h1>
        <p className="lead">הקנייה נשארת מוכרת: קטגוריה, מוצר, סל, תשלום. מה שמשתנה זה המחירון, וההנחה שננעלת כשמשלימים סטאפ.</p>
      </div>
      <div className="gate-grid">
        <button type="button" className="panel private" onClick={() => enter('private')}>
          <div>
            <p className="eyebrow">לקוחות פרטיים</p>
            <h2>קונים הביתה</h2>
            <p>מחיר לצרכן, תשלומים, ומשלוח עד הדלת.</p>
          </div>
          <ul className="points">
            <li>מחיר סופי כולל מע״מ</li>
            <li>עד 12 תשלומים באשראי</li>
            <li>מד ההשלמה: 8% כשהסטאפ מלא</li>
          </ul>
          <span className="go">כניסה כפרטי</span>
        </button>
        <button type="button" className="panel business" onClick={() => enter('business')}>
          <div>
            <p className="eyebrow">לקוחות עסקיים</p>
            <h2>מציידים צוות</h2>
            <p>מחיר לפני מע״מ, הנחת כמות, והצעת מחיר.</p>
          </div>
          <ul className="points">
            <li>מחיר ללא מע״מ</li>
            <li>הנחת כמות מ־5 יחידות</li>
            <li>קטגוריית ציוד מחלקות</li>
          </ul>
          <span className="go">כניסה כעסק</span>
        </button>
      </div>
    </div>
  )
}
