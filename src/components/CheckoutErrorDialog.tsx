import { Link } from 'react-router-dom'
import type { CheckoutErrorView } from '../lib/checkout-errors'

export function CheckoutErrorDialog({
  view,
  onRetry,
  onClose,
}: {
  view: CheckoutErrorView
  onRetry: () => void
  onClose: () => void
}) {
  return (
    <div className="checkout-error-scrim" role="presentation" onClick={onClose}>
      <div
        className="checkout-error-sheet"
        role="dialog"
        aria-labelledby="checkout-error-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="checkout-error-icon" aria-hidden="true">
          !
        </div>
        <h2 id="checkout-error-title">{view.title}</h2>
        <p>{view.message}</p>
        <div className="checkout-error-actions">
          {view.retry ? (
            <button type="button" className="btn" onClick={onRetry}>
              נסה שוב
            </button>
          ) : null}
          {view.backToCart ? (
            <Link className="btn secondary" to="/cart" onClick={onClose}>
              חזרה לסל
            </Link>
          ) : (
            <button type="button" className="btn secondary" onClick={onClose}>
              סגירה
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
