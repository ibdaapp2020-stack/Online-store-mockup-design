import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { adminFetch } from '../lib/data/http'
import type { HeroSlide, ShopSettings } from '../types'

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: 'slide-new',
    title: 'מוצרים חדשים ופתרונות אורתופדיים מתקדמים',
    subtitle: 'תמיכה, ניידות וציוד ביתי חדש במדף לשגרת חיים נוחה ובטוחה.',
    badge: 'חדש באתר',
    link: '/catalog?badge=new',
    image: '/products/walker-std.jpg',
    active: true,
  },
  {
    id: 'slide-clinic',
    title: 'מרפאות וייעוץ מקצועי PRO PHARM',
    subtitle: 'מדידה וייעוץ במרפאה עם מומחים, ובאותו ביקור רואים את המוצרים.',
    badge: 'קביעת תור',
    link: '/account#appointments',
    image: '/products/knee-sleeve.jpg',
    active: true,
  },
  {
    id: 'slide-kit',
    title: 'מארז שיקום ותנועה במחיר מיוחד',
    subtitle: 'ערכת עזרה ראשונה ואביזרי תנועה במחיר מוזל לזמן מוגבל.',
    badge: 'מבצע חם',
    link: '/p/kit',
    image: '/products/kit.jpg',
    active: true,
  },
]

export function AdminBanner() {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [showBanner, setShowBanner] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [siteDiscountPercent, setSiteDiscountPercent] = useState(0)
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Form state for adding/editing a slide
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [badge, setBadge] = useState('')
  const [link, setLink] = useState('/catalog')
  const [image, setImage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [bgColor, setBgColor] = useState('')

  useEffect(() => {
    void adminFetch<ShopSettings>('/api/admin/settings')
      .then((data) => {
        setShowBanner(Boolean(data.showBanner))
        setBannerText(data.banner || '')
        setSiteDiscountPercent(data.siteDiscountPercent || 0)
        setSlides(data.slides && data.slides.length > 0 ? data.slides : DEFAULT_SLIDES)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'טעינת ההגדרות נכשלה'))
  }, [])

  function resetSlideForm() {
    setEditingSlide(null)
    setTitle('')
    setSubtitle('')
    setBadge('')
    setLink('/catalog')
    setImage('')
    setVideoUrl('')
    setBgColor('')
  }

  function startEdit(slide: HeroSlide) {
    setEditingSlide(slide)
    setTitle(slide.title)
    setSubtitle(slide.subtitle)
    setBadge(slide.badge || '')
    setLink(slide.link)
    setImage(slide.image || '')
    setVideoUrl(slide.videoUrl || '')
    setBgColor(slide.bgColor || '')
    window.scrollTo({ top: 300, behavior: 'smooth' })
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
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
      setImage(res.url)
      setNotice('התמונה הועלתה בהצלחה!')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'העלאת התמונה נכשלה')
    } finally {
      setUploading(false)
    }
  }

  function handleSaveSlide(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('חובה למלא כותרת לשקף')
      return
    }

    if (editingSlide) {
      setSlides((prev) =>
        prev.map((s) =>
          s.id === editingSlide.id
            ? {
                ...s,
                title: title.trim(),
                subtitle: subtitle.trim(),
                badge: badge.trim(),
                link: link.trim() || '/catalog',
                image: image.trim(),
                videoUrl: videoUrl.trim(),
                bgColor: bgColor.trim(),
              }
            : s,
        ),
      )
      setNotice('השקף עודכן ברשימה. לחצו על "שמור שינויים לאתר" כדי להחיל.')
    } else {
      const newSlide: HeroSlide = {
        id: `slide-${Date.now().toString(36)}`,
        title: title.trim(),
        subtitle: subtitle.trim(),
        badge: badge.trim(),
        link: link.trim() || '/catalog',
        image: image.trim(),
        videoUrl: videoUrl.trim(),
        bgColor: bgColor.trim(),
        active: true,
      }
      setSlides((prev) => [...prev, newSlide])
      setNotice('השקף נוסף לרשימה! לחצו על "שמור שינויים לאתר" כדי להחיל.')
    }
    resetSlideForm()
  }

  function moveSlide(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= slides.length) return
    setSlides((prev) => {
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[targetIndex]
      copy[targetIndex] = temp
      return copy
    })
  }

  function toggleSlideActive(id: string) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)))
  }

  function deleteSlide(id: string) {
    if (!window.confirm('למחוק את שקף הבאנר הזה?')) return
    setSlides((prev) => prev.filter((s) => s.id !== id))
  }

  async function saveAll() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await adminFetch<ShopSettings>('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showBanner,
          banner: bannerText.trim(),
          siteDiscountPercent: Number(siteDiscountPercent) || 0,
          slides,
        }),
      })
      setNotice('הבאנרים וההגדרות נשמרו בהצלחה ומעודכנים כעת באתר!')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'השמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="banner-page">
      <div className="section-head">
        <div>
          <h1>ניהול באנרים ושיווק</h1>
          <p className="admin-lede">שליטה מלאה בבאנר המתחלף במסך הבית, בפס המבצעים העליון, ובהנחה כללית לכל האתר.</p>
        </div>
        <button type="button" className="btn" disabled={saving} onClick={() => void saveAll()}>
          {saving ? 'שומר שינויים...' : 'שמור שינויים לאתר ✓'}
        </button>
      </div>

      {notice ? <p className="profile-note">{notice}</p> : null}
      {error ? <p className="form-errors">{error}</p> : null}

      {/* 1. פס הודעות עליון */}
      <section className="panel banner-section">
        <h2>פס הודעות ומבצעים עליון (Announcement Bar)</h2>
        <p className="muted">פס זה מופיע בראש כל דפי האתר, ומשמש להודעות שיווקיות כמו משלוח חינם או הנחות.</p>

        <label className="check-line" style={{ margin: '1rem 0' }}>
          <input type="checkbox" checked={showBanner} onChange={(e) => setShowBanner(e.target.checked)} />
          <span>הצג את פס ההודעות בראש האתר</span>
        </label>

        {showBanner ? (
          <div className="banner-preview-box">
            <span className="muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>
              תצוגה מקדימה כפי שמופיע באתר:
            </span>
            <div className="demo-banner-preview">{bannerText || 'הקלידו טקסט להצגה בפס העליון'}</div>
          </div>
        ) : null}

        <label style={{ display: 'grid', gap: '0.4rem', marginTop: '0.8rem' }}>
          <span>טקסט ההודעה בפס העליון</span>
          <input
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            placeholder="לדוגמה: משלוח חינם בהזמנות מעל ₪199 | התאמת מדרסים במרפאות"
          />
        </label>
      </section>

      {/* 2. הנחה כללית לכל האתר */}
      <section className="panel banner-section">
        <h2>הנחה כללית לכל האתר (Site-wide Discount)</h2>
        <p className="muted">הגדרת הנחה רוחבית (למשל 10% או 20%) שמחושבת אוטומטית לכל הלקוחות בסל הקניות.</p>
        <div style={{ maxWidth: '240px', marginTop: '0.8rem' }}>
          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span>אחוז הנחה כללי (%)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={siteDiscountPercent}
              onChange={(e) => setSiteDiscountPercent(Number(e.target.value) || 0)}
              placeholder="0 ללא הנחה כללית"
            />
          </label>
        </div>
        {siteDiscountPercent > 0 ? (
          <p className="profile-note" style={{ marginTop: '0.6rem' }}>
            מופעלת הנחה כללית של <strong>{siteDiscountPercent}%</strong> על כל המוצרים באתר!
          </p>
        ) : null}
      </section>

      {/* 3. שקפי באנר ראשי במסך הבית */}
      <section className="panel banner-section">
        <div className="section-head" style={{ marginBottom: '1rem' }}>
          <div>
            <h2>שקפים מתחלפים בבאנר הראשי (Hero Slider)</h2>
            <p className="muted">השקפים הגדולים שמוצגים בראש עמוד הבית עם תמונות, כותרות, קישורים או סרטונים.</p>
          </div>
          {editingSlide ? (
            <button type="button" className="text-btn" onClick={resetSlideForm}>
              ביטול עריכה
            </button>
          ) : null}
        </div>

        {/* טופס הוספה / עריכה */}
        <form className="slide-form" onSubmit={handleSaveSlide}>
          <h3>{editingSlide ? 'עריכת שקף' : '+ הוספת שקף חדש'}</h3>
          <div className="split-fields">
            <label>
              <span>כותרת ראשית *</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: מוצרים חדשים" required />
            </label>
            <label>
              <span>תגית שיווקית קטנה</span>
              <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="לדוגמה: חדש / מבצע חם" />
            </label>
          </div>

          <label>
            <span>כותרת משנה / פירוט</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="פירוט קצר על המבצע או השירות..."
            />
          </label>

          <div className="split-fields">
            <label>
              <span>קישור יעד (לאן מועבר בלחיצה)</span>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/catalog או /account#appointments או /p/kit"
              />
            </label>
            <label>
              <span>צבע רקע (אופציונלי, קוד צבע או גרדיאנט)</span>
              <input value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="#163a66" />
            </label>
          </div>

          <div className="split-fields">
            <label>
              <span>כתובת תמונה (URL)</span>
              <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://... או /products/..." />
            </label>
            <label>
              <span>או העלאת קובץ תמונה מהמחשב</span>
              <input type="file" accept="image/*" onChange={(e) => void handleFileUpload(e)} disabled={uploading} />
              {uploading ? <span className="muted">מעלה תמונה...</span> : null}
            </label>
          </div>

          <label>
            <span>קישור לסרטון וידאו (אופציונלי, MP4 / WebM)</span>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://.../video.mp4" />
          </label>

          {image ? (
            <div className="slide-img-preview">
              <span>תצוגה מקדימה של התמונה:</span>
              <img src={image} alt="תצוגה מקדימה" style={{ maxHeight: '100px', borderRadius: '8px', marginTop: '0.4rem' }} />
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem' }}>
            <button className="btn" type="submit">
              {editingSlide ? 'עדכן שקף זה' : 'הוסף שקף לרשימה'}
            </button>
            {editingSlide ? (
              <button className="btn secondary" type="button" onClick={resetSlideForm}>
                ביטול
              </button>
            ) : null}
          </div>
        </form>

        {/* רשימת שקפים קיימים */}
        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.8rem' }}>רשימת השקפים הקיימים ({slides.length})</h3>
        <div className="slides-list">
          {slides.map((s, idx) => (
            <article className={`slide-item-card ${s.active === false ? 'slide-disabled' : ''}`} key={s.id}>
              <div className="slide-thumb">
                {s.videoUrl ? (
                  <span className="badge">וידאו</span>
                ) : (
                  <img src={s.image || '/logo.jpg'} alt="" />
                )}
              </div>

              <div className="slide-content">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {s.badge ? <span className="badge category-badge">{s.badge}</span> : null}
                  <strong>{s.title}</strong>
                  {s.active === false ? <span className="badge" style={{ background: '#eee' }}>מושבת</span> : null}
                </div>
                <p className="muted" style={{ margin: '0.2rem 0' }}>{s.subtitle}</p>
                <small className="muted">מפנה אל: {s.link}</small>
              </div>

              <div className="slide-actions">
                <button
                  type="button"
                  className="step-btn"
                  title="הזז למעלה"
                  disabled={idx === 0}
                  onClick={() => moveSlide(idx, 'up')}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="step-btn"
                  title="הזז למטה"
                  disabled={idx === slides.length - 1}
                  onClick={() => moveSlide(idx, 'down')}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => toggleSlideActive(s.id)}
                >
                  {s.active === false ? 'הפעל' : 'השבת'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => startEdit(s)}
                >
                  עריכה
                </button>
                <button
                  type="button"
                  className="text-btn danger-text"
                  onClick={() => deleteSlide(s.id)}
                >
                  מחיקה
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button type="button" className="btn" style={{ padding: '0.9rem 2.5rem', fontSize: '1.1rem' }} disabled={saving} onClick={() => void saveAll()}>
          {saving ? 'שומר שינויים...' : 'שמור שינויים לאתר ✓'}
        </button>
      </div>
    </div>
  )
}
