import { Link, useParams } from 'react-router-dom'
import { money } from '../pricing'
import { useStore } from '../store'

const shipLabel = {
  standard: 'שליח עד הבית',
  express: 'אקספרס',
  pickup: 'איסוף עצמי',
}

export function Thanks() {
  const { id = '' } = useParams()
  const { orders } = useStore()
  const order = orders.find((item) => item.id === id)

  if (!order) {
    return (
      <div className="wrap empty">
        <h1>ההזמנה לא נמצאה</h1>
        <Link className="btn btn-primary" to="/shop">
          לחנות
        </Link>
      </div>
    )
  }

  const quote = order.kind === 'quote'

  return (
    <div className="wrap thanks">
      <p className="kicker">{quote ? 'הצעת מחיר' : 'הזמנה'}</p>
      <h1>{quote ? 'ההצעה נשמרה' : 'ההזמנה נקלטה'}</h1>
      <p className="order-id">{order.id}</p>
      {order.pointsEarned ? <p className="saving">נוספו {order.pointsEarned} נקודות למועדון</p> : null}
      <p className="lead">
        {quote
          ? 'נחזור אליך לטלפון עם המחיר.'
          : `חשבונית ${order.invoiceId ?? order.id} הופקה עבור ${order.customer.email}.`}
      </p>
      <div className="thanks-card">
        <div className="row">
          <span>לקוח</span>
          <span>{order.customer.name}</span>
        </div>
        <div className="row">
          <span>טלפון</span>
          <span>{order.customer.phone}</span>
        </div>
        <div className="row">
          <span>אספקה</span>
          <span>
            {shipLabel[order.ship]} · {order.customer.address}
          </span>
        </div>
        <div className="row">
          <span>תשלום</span>
          <span>
            {order.payment}
            {order.payments > 1 ? ` · ${order.payments} תשלומים` : ''}
          </span>
        </div>
        {order.lines.map((line) => (
          <div className="row" key={line.productId}>
            <span>
              {line.name} × {line.qty}
            </span>
            <span>{money(line.unit * line.qty)}</span>
          </div>
        ))}
        {order.discount > 0 && (
          <div className="row">
            <span>הנחות</span>
            <span className="saving">−{money(order.discount)}</span>
          </div>
        )}
        <div className="row total">
          <span>לתשלום</span>
          <span>{money(order.total)}</span>
        </div>
      </div>
      <div className="hero-actions">
        <Link className="btn btn-primary" to="/shop">
          חזרה לחנות
        </Link>
        <Link className="btn btn-ghost" to={`/invoice/${order.id}`}>
          לחשבונית
        </Link>
      </div>
    </div>
  )
}
