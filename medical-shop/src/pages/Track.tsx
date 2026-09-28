import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { STATUS_FLOW, STATUS_LABEL } from '../data'
import { EmptyState, useTitle } from '../components/ui'
import { formatDate, money } from '../pricing'
import { useStore } from '../store'

export function TrackPage() {
  useTitle('מעקב הזמנה')
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { orders, advanceStatus } = useStore()
  const [query, setQuery] = useState(id)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setQuery(id)
  }, [id])
  const [missingInput, setMissingInput] = useState(false)
  const order = id ? orders.find((item) => item.id.toLowerCase() === id.toLowerCase()) : undefined

  return (
    <div>
      <h1>מעקב הזמנה</h1>
      <p className="lede">הזינו מספר הזמנה. ארבע הזמנות דמו כבר ממתינות, והזמנות חדשות נשמרות בדפדפן.</p>
      <form
        className="track-form"
        onSubmit={(event) => {
          event.preventDefault()
          const next = query.trim()
          if (!next) {
            setMissingInput(true)
            return
          }
          setMissingInput(false)
          setSearching(true)
          window.setTimeout(() => {
            setSearching(false)
            navigate(`/track/${next}`)
          }, 400)
        }}
      >
        <label>
          מספר הזמנה
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="MED-10041" />
        </label>
        <button type="submit" className="btn" disabled={searching}>
          {searching ? 'מחפש...' : 'חיפוש'}
        </button>
      </form>
      {missingInput ? (
        <p role="alert" className="form-errors">
          הזינו מספר הזמנה.
        </p>
      ) : null}
      {searching ? <p role="status">מחפש הזמנה...</p> : null}

      {id && !searching && !order ? (
        <EmptyState title="ההזמנה לא נמצאה" text={`אין הזמנה עם המספר ${id} בדפדפן הזה.`} />
      ) : null}

      {order && !searching ? (
        <article className="panel track-card">
          <div className="section-head">
            <div>
              <h2>{order.id}</h2>
              <p className="muted">
                {formatDate(order.createdAt)} · {order.customer.name} · {order.customer.city}
              </p>
            </div>
            <strong>{money(order.total)}</strong>
          </div>
          <ol className="timeline">
            {STATUS_FLOW.map((status, index) => {
              const current = STATUS_FLOW.indexOf(order.status)
              const state = index < current ? 'done' : index === current ? 'current' : 'wait'
              return (
                <li key={status} className={`step ${state}`}>
                  <span className="step-dot" />
                  <span>{STATUS_LABEL[status]}</span>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            className="btn secondary"
            disabled={order.status === 'delivered'}
            onClick={() => advanceStatus(order.id)}
          >
            {order.status === 'delivered' ? 'ההזמנה נמסרה' : 'קדם סטטוס (דמו)'}
          </button>
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
        </article>
      ) : null}

      <section>
        <h2>הזמנות בדפדפן</h2>
        <div className="order-list">
          {orders.map((item) => (
            <Link key={item.id} to={`/track/${item.id}`} className={item.id === order?.id ? 'order-pill on' : 'order-pill'}>
              <strong>{item.id}</strong>
              <span>{STATUS_LABEL[item.status]}</span>
              <span>{item.customer.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
