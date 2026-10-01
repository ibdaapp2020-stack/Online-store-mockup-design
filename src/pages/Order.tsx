import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, useTitle } from '../components/ui'
import { formatDate, money } from '../pricing'
import { useStore } from '../store'
import { variantLabel } from '../types'
import type { Order } from '../types'

export function OrderPage() {
  const { id = '' } = useParams()
  const { settings, findOrder } = useStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [missing, setMissing] = useState(false)
  useTitle(order ? `הזמנה ${order.id}` : 'הזמנה')

  useEffect(() => {
    let active = true
    void findOrder(id)
      .then((found) => {
        if (!active) return
        if (!found) setMissing(true)
        else setOrder(found)
      })
      .catch(() => {
        if (active) setMissing(true)
      })
    return () => {
      active = false
    }
  }, [id])

  if (missing) {
    return <EmptyState title="ההזמנה לא נמצאה" text="המספר אינו שמור בחנות." action={<Link className="btn" to="/track">למעקב</Link>} />
  }
  if (!order) return <p>טוען הזמנה...</p>

  return (
    <div className="confirm">
      <p className="eyebrow">{settings.paymentNote}</p>
      <h1>ההזמנה התקבלה בהצלחה</h1>
      <p className="order-id">{order.id}</p>
      <p className="muted">{formatDate(order.createdAt)}</p>
      <p>סטטוס תשלום: ממתין לסליקה · איסוף עצמי</p>
      <div className="panel summary wide">
        <h2>סיכום</h2>
        <ul className="mini-lines">
          {order.items.map((item) => (
            <li key={`${item.productId}-${item.name}`}>
              <span>
                {item.name}
                {variantLabel(item) ? ` (${variantLabel(item)})` : ''} × {item.qty}
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
