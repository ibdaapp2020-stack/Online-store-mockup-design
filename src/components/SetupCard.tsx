import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { blueprintFor, setupById } from '../data'
import { money, quote, setupRateLabel } from '../pricing'
import { useStore } from '../store'
import type { Setup } from '../types'
import { Qty } from './ui'

export function SetupCard({ setup }: { setup: Setup }) {
  const { audience, products, applySetup, pricesOpen } = useStore()
  const navigate = useNavigate()
  const [qty, setQty] = useState(audience === 'business' ? 5 : 1)
  const ids = audience ? blueprintFor(setup.id, audience) : []
  const priced = useMemo(() => {
    if (!audience) return null
    const lines = ids.flatMap((id) => {
      const product = products.find((item) => item.id === id && item.active && item.stock > 0)
      return product ? [{ productId: id, qty: Math.min(qty, product.stock) }] : []
    })
    return quote(products, lines, audience, 'standard')
  }, [audience, ids, products, qty])

  if (!audience || !priced) return null
  const ready = ids.every((id) => products.some((item) => item.id === id && item.active && item.stock > 0))
  const label = setupById(setup.id)?.name ?? setup.name

  return (
    <article className="setup-card">
      <p className="eyebrow">{audience === 'business' ? 'שכפול עמדה' : 'מד ההשלמה'}</p>
      <h3>{label}</h3>
      <p className="muted">{setup.line}</p>
      <div className="role-pills">
        {setup.roles.map((role) => (
          <span key={role.id}>{role.label}</span>
        ))}
      </div>
      {audience === 'business' && (
        <div className="stamp-row">
          <span>כמה {setup.id === 'pocket' ? 'ערכות' : 'עמדות'}?</span>
          <Qty value={qty} min={1} max={30} onChange={setQty} />
        </div>
      )}
      {pricesOpen && (
        <div className="price-row">
          <strong className="price">{money(audience === 'business' ? priced.net : priced.total)}</strong>
          <span className="saving">
            {priced.discount > 0 ? `חיסכון ${money(priced.discount + priced.volumeSaved)}` : setupRateLabel(audience)}
          </span>
        </div>
      )}
      <p className="fine">
        {ready
          ? `כולל ${setupRateLabel(audience)} הנחה ומשלוח${audience === 'business' ? ' · לפני מע״מ' : ''}`
          : 'חלק מהסטאפ אזל כרגע'}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!ready || !pricesOpen}
        onClick={() => {
          applySetup(setup.id, audience === 'business' ? qty : 1)
          navigate('/cart')
        }}
      >
        {audience === 'business' ? `הוספת ${qty} לסל` : 'הוספת הסטאפ לסל'}
      </button>
    </article>
  )
}
