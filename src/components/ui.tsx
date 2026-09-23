import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { CategoryId } from '../types'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={light ? 'logo light' : 'logo'}>
      <span className="mark" aria-hidden="true" />
      <span className="word">DESIGMA</span>
    </span>
  )
}

export function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <span className="stars" aria-label={`דירוג ${value} מתוך 5`}>
      {'★★★★★'.slice(0, full)}
      <span className="dim">{'★★★★★'.slice(full)}</span>
    </span>
  )
}

export function Qty({
  value,
  min = 1,
  max = 99,
  onChange,
}: {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="qty">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="הפחתה">
        −
      </button>
      <input
        aria-label="כמות"
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10)
          if (Number.isNaN(next)) return
          onChange(Math.max(min, Math.min(max, next)))
        }}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="הוספה">
        +
      </button>
    </div>
  )
}

export function Glyph({ cat, size = 72 }: { cat: CategoryId; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 80 80', fill: 'none' }
  if (cat === 'mobile') {
    return (
      <svg {...props} aria-hidden="true">
        <rect x="27" y="10" width="26" height="60" rx="7" stroke="currentColor" strokeWidth="2.6" />
        <circle cx="40" cy="62" r="2" fill="currentColor" />
        <path d="M34 18h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }
  if (cat === 'computer') {
    return (
      <svg {...props} aria-hidden="true">
        <rect x="14" y="16" width="52" height="34" rx="4" stroke="currentColor" strokeWidth="2.6" />
        <path d="M32 58h16M40 50v8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (cat === 'gaming') {
    return (
      <svg {...props} aria-hidden="true">
        <rect x="12" y="28" width="56" height="26" rx="13" stroke="currentColor" strokeWidth="2.6" />
        <path d="M24 41h8M28 37v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="52" cy="38" r="2" fill="currentColor" />
        <circle cx="58" cy="44" r="2" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg {...props} aria-hidden="true">
      <rect x="30" y="12" width="20" height="30" rx="6" stroke="currentColor" strokeWidth="2.6" />
      <path d="M34 42h12v8a6 6 0 0 1-12 0v-8Z" stroke="currentColor" strokeWidth="2.6" />
      <path d="M40 58v10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function ProductPhoto({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return <img src={src} alt={alt} onError={() => setFailed(true)} />
}

export function Empty({ title, text, to, action }: { title: string; text: string; to: string; action: string }) {
  return (
    <div className="empty">
      <h1>{title}</h1>
      <p>{text}</p>
      <Link className="btn btn-primary" to={to}>
        {action}
      </Link>
    </div>
  )
}
