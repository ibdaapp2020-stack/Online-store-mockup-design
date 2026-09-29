import { useEffect, useState, type ReactNode } from 'react'
import type { Badge } from '../types'

const BADGE_LABEL: Record<Badge, string> = {
  new: 'חדש',
  sale: 'מבצע',
  popular: 'נמכר',
}

export function useTitle(title: string) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · PRO PHARM`
  }, [title])
}

export function useMockDelay(ms = 350) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), ms)
    return () => window.clearTimeout(timer)
  }, [ms])
  return ready
}

export function Stars({ rating, reviews }: { rating: number; reviews?: number }) {
  const full = Math.round(rating)
  return (
    <span className="stars" aria-label={`דירוג ${rating} מתוך 5`}>
      <span aria-hidden="true">{'★★★★★'.slice(0, full)}</span>
      <span className="stars-dim" aria-hidden="true">
        {'★★★★★'.slice(full)}
      </span>
      <span className="rating-num">{rating.toFixed(1)}</span>
      {typeof reviews === 'number' ? <span className="reviews">{reviews} ביקורות דמו</span> : null}
    </span>
  )
}

export function BadgeTag({ badge }: { badge?: Badge }) {
  if (!badge) return null
  return <span className={`badge ${badge}`}>{BADGE_LABEL[badge]}</span>
}

export function QtyControl({ qty, max, onChange }: { qty: number; max: number; onChange: (qty: number) => void }) {
  return (
    <div className="qty">
      <button type="button" aria-label="הפחתת כמות" onClick={() => onChange(qty - 1)} disabled={qty <= 1}>
        −
      </button>
      <span>{qty}</span>
      <button type="button" aria-label="הגברת כמות" onClick={() => onChange(qty + 1)} disabled={qty >= max}>
        +
      </button>
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  )
}
