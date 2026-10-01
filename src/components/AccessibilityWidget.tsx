import { useEffect, useId, useRef, useState } from 'react'
import {
  A11Y_DEFAULT,
  applyA11yPrefs,
  loadA11yPrefs,
  saveA11yPrefs,
  type A11yPrefs,
  clampTextScale,
} from '../lib/accessibility'

function toggle(prefs: A11yPrefs, key: keyof Omit<A11yPrefs, 'textScale'>): A11yPrefs {
  return { ...prefs, [key]: !prefs[key] }
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<A11yPrefs>(A11Y_DEFAULT)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPrefs(loadA11yPrefs())
  }, [])

  function commit(next: A11yPrefs) {
    setPrefs(next)
    applyA11yPrefs(next)
    saveA11yPrefs(next)
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="a11y-root">
      <button
        ref={buttonRef}
        type="button"
        className="a11y-fab"
        aria-label="פתיחת תפריט נגישות"
        aria-expanded={open}
        aria-controls={panelId}
        title="נגישות"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-7.5 6.2 5.1-.9h4.8l5.1.9a1 1 0 1 1-.35 1.97l-3.75-.66V22h-2.2v-6.4h-2.4V22H8.1V9.51l-3.75.66A1 1 0 0 1 4 8.2c.16 0 .32-.03.5 0z"
          />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="a11y-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-title`}
        >
          <header className="a11y-panel-head">
            <div>
              <h2 id={`${panelId}-title`}>נגישות</h2>
              <p>התאמת תצוגת האתר לצרכים שלך</p>
            </div>
            <button ref={closeRef} type="button" className="a11y-close" aria-label="סגירת תפריט נגישות" onClick={() => setOpen(false)}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="a11y-actions">
            <button type="button" className="a11y-btn" onClick={() => commit({ ...prefs, textScale: clampTextScale(prefs.textScale + 1) })}>
              A+ הגדלת טקסט
            </button>
            <button type="button" className="a11y-btn" onClick={() => commit({ ...prefs, textScale: clampTextScale(prefs.textScale - 1) })}>
              A- הקטנת טקסט
            </button>
            <button type="button" className="a11y-btn" onClick={() => commit({ ...prefs, textScale: 0 })}>
              A איפוס גודל טקסט
            </button>
            <button type="button" className="a11y-btn" aria-pressed={prefs.contrast} onClick={() => commit(toggle(prefs, 'contrast'))}>
              ניגודיות גבוהה
            </button>
            <button type="button" className="a11y-btn" aria-pressed={prefs.gray} onClick={() => commit(toggle(prefs, 'gray'))}>
              גווני אפור
            </button>
            <button type="button" className="a11y-btn" aria-pressed={prefs.links} onClick={() => commit(toggle(prefs, 'links'))}>
              הדגשת קישורים
            </button>
            <button type="button" className="a11y-btn" aria-pressed={prefs.readable} onClick={() => commit(toggle(prefs, 'readable'))}>
              גופן קריא
            </button>
            <button type="button" className="a11y-btn" aria-pressed={prefs.motion} onClick={() => commit(toggle(prefs, 'motion'))}>
              עצירת אנימציות
            </button>
            <button type="button" className="a11y-btn" aria-pressed={prefs.cursor} onClick={() => commit(toggle(prefs, 'cursor'))}>
              סמן עכבר גדול
            </button>
          </div>
          <button type="button" className="a11y-reset" onClick={() => commit({ ...A11Y_DEFAULT })}>
            איפוס הגדרות נגישות
          </button>
        </div>
      ) : null}
    </div>
  )
}
