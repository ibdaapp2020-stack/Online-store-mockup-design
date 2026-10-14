import type { ProductStats as Stats } from './productService'

export function ProductStats({ stats }: { stats: Stats | null }) {
  const cards = [
    { label: 'סה״כ מוצרים', value: stats?.total ?? '—', tone: '' },
    { label: 'מוצרים פעילים', value: stats?.active ?? '—', tone: 'ok' },
    { label: 'מלאי נמוך', value: stats?.lowStock ?? '—', tone: 'warn' },
    { label: 'אזלו מהמלאי', value: stats?.outOfStock ?? '—', tone: 'bad' },
  ]
  return (
    <div className="product-stats" aria-live="polite">
      {cards.map((card) => (
        <article key={card.label} className={card.tone ? `stat-card ${card.tone}` : 'stat-card'}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </div>
  )
}
