import type { ShopSettings } from '../../types'
import { grossProfit, moneyExact } from '../../pricing'

type Form = {
  price: string
  costPrice: string
  salePrice: string
  saleStart: string
  saleEnd: string
  compareAt: string
}

type Props = {
  form: Form
  settings: ShopSettings | null
  canSeeCost: boolean
  disabled?: boolean
  onChange: (key: keyof Form, value: string) => void
}

export function ProductPricing({ form, settings, canSeeCost, disabled, onChange }: Props) {
  const price = Number(form.price)
  const cost = form.costPrice === '' ? undefined : Number(form.costPrice)
  const sale = form.salePrice === '' ? undefined : Number(form.salePrice)
  const effective = sale != null && sale < price ? sale : price
  const profit = canSeeCost ? grossProfit(effective, cost, settings?.vatRate ?? 18, settings?.vatIncluded !== false) : null

  return (
    <section className="form-block">
      <h2>מחירים</h2>
      <div className="split-fields">
        <label>
          מחיר מכירה
          <input value={form.price} disabled={disabled} inputMode="decimal" required onChange={(event) => onChange('price', event.target.value)} />
        </label>
        {canSeeCost ? (
          <label>
            מחיר עלות
            <input value={form.costPrice} disabled={disabled} inputMode="decimal" onChange={(event) => onChange('costPrice', event.target.value)} />
          </label>
        ) : null}
      </div>
      <div className="split-fields">
        <label>
          מחיר מבצע
          <input value={form.salePrice} disabled={disabled} inputMode="decimal" placeholder="אופציונלי" onChange={(event) => onChange('salePrice', event.target.value)} />
        </label>
        <label>
          מחיר לפני הנחה
          <input value={form.compareAt} disabled={disabled} inputMode="decimal" placeholder="אופציונלי" onChange={(event) => onChange('compareAt', event.target.value)} />
        </label>
      </div>
      <div className="split-fields">
        <label>
          תחילת מבצע
          <input type="date" value={form.saleStart} disabled={disabled} onChange={(event) => onChange('saleStart', event.target.value)} />
        </label>
        <label>
          סיום מבצע
          <input type="date" value={form.saleEnd} disabled={disabled} onChange={(event) => onChange('saleEnd', event.target.value)} />
        </label>
      </div>
      <p className="muted">מע״מ {settings?.vatRate ?? 18}% {settings?.vatIncluded === false ? 'לא כלול במחיר' : 'כלול במחיר'} לפי הגדרות העסק.</p>
      {profit ? (
        <p className="profit-box">
          רווח גולמי: {moneyExact(profit.profit)} · מרווח {profit.margin}% · מחיר נטו {moneyExact(profit.net)}
        </p>
      ) : null}
    </section>
  )
}
