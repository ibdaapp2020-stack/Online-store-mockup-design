import { Link, useParams } from 'react-router-dom'
import { money } from '../pricing'
import { useStore } from '../store'

export function InvoicePage() {
  const { id = '' } = useParams()
  const { orders } = useStore()
  const order = orders.find((item) => item.id === id || item.invoiceId === id)
  if (!order) {
    return (
      <div className="wrap empty">
        <h1>החשבונית לא נמצאה</h1>
        <Link to="/shop">לחנות</Link>
      </div>
    )
  }

  return (
    <div className="wrap invoice">
      <header className="invoice-head">
        <div>
          <p className="kicker">DESIGMA CITY</p>
          <h1>{order.kind === 'quote' ? 'הצעת מחיר' : 'חשבונית מס'}</h1>
          <p>{order.invoiceId ?? order.id}</p>
        </div>
        <button type="button" className="btn btn-dark" onClick={() => window.print()}>
          הדפסה
        </button>
      </header>
      <div className="thanks-card">
        <div className="row">
          <span>תאריך</span>
          <span>{new Date(order.invoiceSentAt ?? order.createdAt).toLocaleString('he-IL')}</span>
        </div>
        <div className="row">
          <span>לכבוד</span>
          <span>{order.customer.name}</span>
        </div>
        <div className="row">
          <span>נשלח אל</span>
          <span>{order.customer.email || order.invoiceId}</span>
        </div>
        <div className="row">
          <span>טלפון</span>
          <span>{order.customer.phone}</span>
        </div>
        {order.lines.map((line) => (
          <div className="row" key={`${line.productId}-${line.name}`}>
            <span>
              {line.name} × {line.qty}
            </span>
            <span>{money(line.unit * line.qty)}</span>
          </div>
        ))}
        <div className="row">
          <span>מע״מ</span>
          <span>{money(order.vat)}</span>
        </div>
        <div className="row total">
          <span>לתשלום</span>
          <span>{money(order.total)}</span>
        </div>
      </div>
      <p className="fine">החשבונית הופקה אוטומטית עם סגירת ההזמנה ונשמרה עבור {order.customer.email}.</p>
    </div>
  )
}
