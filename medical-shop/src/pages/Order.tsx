import { Link, useParams } from 'react-router-dom'
import { EmptyState, useTitle } from '../components/ui'
import { formatDate, money } from '../pricing'
import { useStore } from '../store'

export function OrderPage() {
  const { id = '' } = useParams()
  const { orders } = useStore()
  const order = orders.find((item) => item.id === id)
  useTitle(order ? `הזמנה ${order.id}` : 'הזמנה')

  if (!order) {
    return <EmptyState title="ההזמנה לא נמצאה" text="המספר אינו שמור בדפדפן הזה." action={<Link className="btn" to="/track">למעקב</Link>} />
  }

  return (
    <div className="confirm">
      <p className="eyebrow">התשלום היה להדגמה ולא חויב כסף</p>
      <h1>ההזמנה נקלטה</h1>
      <p className="order-id">{order.id}</p>
      <p className="muted">{formatDate(order.createdAt)}</p>
      <div className="panel summary wide">
        <h2>סיכום</h2>
        <ul className="mini-lines">
          {order.items.map((item) => (
            <li key={item.productId}>
              <span>
                {item.name} × {item.qty}
              </span>
              <span>{money(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="summary-row">
          <span>הנחה</span>
          <span>{order.discount ? `−${money(order.discount)}` : money(0)}</span>
        </div>
        <div className="summary-row">
          <span>משלוח</span>
          <span>{order.shipping === 0 ? 'חינם' : money(order.shipping)}</span>
        </div>
        <div className="summary-row total">
          <span>סה״כ</span>
          <span>{money(order.total)}</span>
        </div>
        <p>
          {order.customer.name} · {order.customer.city} · {order.customer.address}
        </p>
        <p className="muted">פרטי הכרטיס לא נשמרו.</p>
      </div>
      <Link className="btn" to={`/track/${order.id}`}>
        למעקב ההזמנה
      </Link>
    </div>
  )
}
