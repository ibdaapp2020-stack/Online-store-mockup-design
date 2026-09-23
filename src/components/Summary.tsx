import { money, nextGap, quote, setupRateLabel } from '../pricing'
import { useStore } from '../store'
import type { ShipMethod } from '../types'
import { Meter } from './Meter'

export function Summary({ ship }: { ship: ShipMethod }) {
  const { audience, products, cart, addToCart } = useStore()
  if (!audience) return null
  const priced = quote(products, cart, audience, ship)
  const gap = nextGap(products, cart, audience)
  const started = priced.progress.filter((item) => item.filledRoles.length > 0)
  const rateLabel = setupRateLabel(audience)

  return (
    <aside className="summary">
      <h2>סיכום</h2>
      {started.map((item) => (
        <Meter key={item.setup.id} progress={item} />
      ))}
      {gap?.product && (
        <div className="gap">
          <p>
            <b>
              {gap.filled}/{gap.total}
            </b>{' '}
            ב{gap.setup.name}. חסר {gap.role.label} כדי לנעול {rateLabel} ומשלוח חינם.
          </p>
          <button type="button" className="btn btn-yellow" onClick={() => addToCart(gap.product!.id)}>
            הוסיפו {gap.product.name}
          </button>
        </div>
      )}
      <div className="rows">
        <div className="row">
          <span>{audience === 'business' ? 'סכום מחירון לפני מע״מ' : 'סכום ביניים'}</span>
          <span>{money(priced.merchandise + priced.volumeSaved)}</span>
        </div>
        {priced.volumeSaved > 0 && (
          <div className="row">
            <span>הנחת כמות</span>
            <span className="saving">−{money(priced.volumeSaved)}</span>
          </div>
        )}
        {priced.setupSavings.map((saving) => (
          <div className="row" key={saving.setup.id}>
            <span>{audience === 'business' ? 'הנחת ערכת מחלקה' : 'הנחת השלמה'} · {saving.setup.name}</span>
            <span className="saving">−{money(saving.amount)}</span>
          </div>
        ))}
        <div className="row">
          <span>{audience === 'business' ? 'משלוח לפני מע״מ' : 'משלוח'}</span>
          <span>{priced.shipping === 0 ? 'חינם' : money(priced.shipping)}</span>
        </div>
        <div className="row">
          <span>{audience === 'business' ? 'מע״מ 17%' : 'מתוכם מע״מ'}</span>
          <span>{money(priced.vat)}</span>
        </div>
        <div className="row total">
          <span>לתשלום</span>
          <span>{money(priced.total)}</span>
        </div>
      </div>
    </aside>
  )
}
