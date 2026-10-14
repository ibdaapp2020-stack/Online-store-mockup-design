import type { ProductEvent, ShopSettings } from '../../types'
import { formatDate } from '../../pricing'

type Form = {
  stock: string
  lowStockThreshold: string
  trackInventory: boolean
  allowBackorder: boolean
  unit: string
}

type Props = {
  form: Form
  settings: ShopSettings | null
  history?: ProductEvent[]
  disabled?: boolean
  onChange: <K extends keyof Form>(key: K, value: Form[K]) => void
}

export function ProductInventory({ form, settings, history, disabled, onChange }: Props) {
  const allowEmpty = Boolean(settings?.allowSellWithoutStock)
  return (
    <section className="form-block">
      <h2>מלאי</h2>
      <div className="split-fields">
        <label>
          כמות נוכחית
          <input value={form.stock} disabled={disabled} inputMode="numeric" required onChange={(event) => onChange('stock', event.target.value)} />
        </label>
        <label>
          סף מלאי נמוך
          <input
            value={form.lowStockThreshold}
            disabled={disabled}
            inputMode="numeric"
            placeholder={`ברירת מחדל ${settings?.lowStockThreshold ?? 5}`}
            onChange={(event) => onChange('lowStockThreshold', event.target.value)}
          />
        </label>
        <label>
          יחידת מידה
          <input value={form.unit} disabled={disabled} onChange={(event) => onChange('unit', event.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.trackInventory} disabled={disabled} onChange={(event) => onChange('trackInventory', event.target.checked)} />
        ניהול מלאי פעיל
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={form.allowBackorder}
          disabled={disabled || !allowEmpty}
          onChange={(event) => onChange('allowBackorder', event.target.checked)}
        />
        מכירה ללא מלאי {allowEmpty ? '' : '(חסום בהגדרות העסק)'}
      </label>
      {history?.filter((item) => item.kind === 'inventory').length ? (
        <div className="history-list">
          <strong>היסטוריית מלאי</strong>
          {history
            .filter((item) => item.kind === 'inventory')
            .map((item) => (
              <p key={item.id}>
                {formatDate(item.createdAt)} · {item.actor} · {item.detail}
              </p>
            ))}
        </div>
      ) : (
        <p className="muted">שינויי מלאי יופיעו כאן אחרי שמירה.</p>
      )}
    </section>
  )
}
