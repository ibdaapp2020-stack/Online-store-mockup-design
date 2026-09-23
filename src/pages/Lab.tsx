import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'

async function shrink(file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image'))
    image.src = data
  })
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return data
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.72)
}

export function Lab() {
  const { submitRepair, repairs } = useStore()
  const [photos, setPhotos] = useState<string[]>([])
  const [sent, setSent] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    device: '',
    issue: '',
    visit: 'home' as 'home' | 'lab',
  })

  const onFiles = async (list: FileList | null) => {
    if (!list) return
    const next = [...photos]
    for (const file of Array.from(list).slice(0, 4 - next.length)) {
      if (!file.type.startsWith('image/')) continue
      next.push(await shrink(file))
    }
    setPhotos(next.slice(0, 4))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (form.name.trim().length < 2 || form.phone.replace(/\D/g, '').length < 9 || form.device.trim().length < 2) return
    const id = submitRepair({ ...form, photos })
    setSent(id)
    setPhotos([])
    setForm({ name: '', phone: '', device: '', issue: '', visit: 'home' })
  }

  return (
    <div className="wrap lab">
      <p className="kicker">מעבדת תיקונים</p>
      <h1>עד הבית, או אצלנו במעבדה.</h1>
      <p className="lead">
        מסך, סוללה, שקע טעינה, גב זכוכית וטיפול אחרי מים. מעלים תמונות של המכשיר ומקבלים הצעת מחיר לפני שקובעים הגעה.
      </p>

      <div className="lab-facts">
        <article>
          <h2>עד הבית</h2>
          <p>טכנאי מגיע לכתובת, עם החלק אם שלחתם תמונה מראש. מתאים למסך, לסוללה ולשקע. משאירים את המכשיר אצלכם.</p>
        </article>
        <article>
          <h2>במעבדה</h2>
          <p>מביאים את המכשיר או שולחים עם שליח. מים, גב זכוכית ורמקול נפתחים אצלנו. איסוף עצמי כשהתיקון מוכן.</p>
        </article>
        <article>
          <h2>אחריות</h2>
          <p>90 יום על תיקון שבוצע. אבחון עד הבית יורד ממחיר התיקון אם ממשיכים. אין הבטחה להצלה אחרי מים.</p>
        </article>
      </div>

      <div className="lab-split">
        <form className="editor" onSubmit={onSubmit}>
          <h2>הצעת מחיר עם תמונות</h2>
          <div className="form-grid">
            <label className="field">
              <span>שם</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label className="field">
              <span>טלפון</span>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} dir="ltr" required />
            </label>
            <label className="field">
              <span>דגם</span>
              <input value={form.device} onChange={(event) => setForm({ ...form, device: event.target.value })} placeholder="למשל iPhone 17" required />
            </label>
            <label className="field">
              <span>איפה לטפל</span>
              <select value={form.visit} onChange={(event) => setForm({ ...form, visit: event.target.value as 'home' | 'lab' })}>
                <option value="home">עד הבית</option>
                <option value="lab">במעבדה</option>
              </select>
            </label>
            <label className="field wide">
              <span>מה קרה</span>
              <textarea rows={4} value={form.issue} onChange={(event) => setForm({ ...form, issue: event.target.value })} />
            </label>
            <label className="field wide">
              <span>תמונות, עד 4</span>
              <input type="file" accept="image/*" multiple onChange={(event) => void onFiles(event.target.files)} />
            </label>
          </div>
          {photos.length > 0 && (
            <div className="shot-row">
              {photos.map((src, index) => (
                <button type="button" key={src.slice(0, 32) + index} onClick={() => setPhotos(photos.filter((_, i) => i !== index))}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary" type="submit">
            שליחת הבקשה
          </button>
          {sent && <p className="saving">הבקשה {sent} נקלטה. נחזור אליך לטלפון עם מחיר.</p>}
        </form>
        <aside className="lab-side">
          <h2>מה בודקים</h2>
          <ul>
            <li>מסך: סדק, מגע, כתמים</li>
            <li>סוללה: כיבוי באמצע היום, גב תפוח</li>
            <li>שקע: כבל שזז והטעינה נעצרת</li>
            <li>מים: מתי נרטב, והאם נדלק</li>
          </ul>
          <Link className="btn btn-ghost" to="/c/repair">
            לשירותים במחירון
          </Link>
          {repairs[0] && <p className="fine">הבקשה האחרונה: {repairs[0].id}</p>}
        </aside>
      </div>
    </div>
  )
}
