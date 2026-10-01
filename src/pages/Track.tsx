import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { STATUS_FLOW, STATUS_LABEL } from '../data'
import { useTitle } from '../components/ui'
import { formatDate, money } from '../pricing'
import { useStore } from '../store'
import { variantLabel, type Order } from '../types'
import { findStoreOrder } from '../lib/data/orders'

export function TrackPage() {
  useTitle('מעקב הזמנה')
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { recentOrders } = useStore()
  const [query, setQuery] = useState(id)
  const [searching, setSearching] = useState(false)
  const [missingInput, setMissingInput] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setQuery(id)
    if (!id) {
      setOrder(null)
      setMissing(false)
      return
    }
    let active = true
    setSearching(true)
    void findStoreOrder(id)
      .then((found) => {
        if (!active) return
        if (!found) {
          setOrder(null)
          setMissing(true)
        } else {
          setOrder(found)
          setMissing(false)
        }
        setSearching(false)
      })
      .catch(() => {
        if (!active) return
        setMissing(true)
        setSearching(false)
      })
    return () => {
      active = false
    }
  }, [id])

  return (
    <div>
      <h1>מעקב הזמנה</h1>
      <p className="lede">הזינו מספר הזמנה. הסטטוס מתעדכן על ידי הנהלת החנות.</p>
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
          navigate(`/track/${next}`)
        }}
      >
        <label>
          מספר הזמנה
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="MED-10041" />
        </label>
        <button type="submit" className="btn">
          חיפוש
        </button>
      </form>
      {missingInput ? <p role="alert" className="form-errors">הזינו מספר הזמנה.</p> : null}
      {searching ? <p role="status">מחפש הזמנה...</p> : null}
      {id && !searching && missing ? <p role="alert" className="form-errors">אין הזמנה עם המספר {id}.</p> : null}
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
          <p className="muted">הסטטוס הנוכחי: {STATUS_LABEL[order.status]}</p>
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
        </article>
      ) : null}
      {recentOrders.length > 0 ? (
        <section>
          <h2>ההזמנות שלי במחשב הזה</h2>
          <div className="order-list">
            {recentOrders.map((item) => (
              <Link key={item.id} to={`/track/${item.id}`} className={item.id === order?.id ? 'order-pill on' : 'order-pill'}>
                <strong>{item.id}</strong>
                <span>{STATUS_LABEL[item.status]}</span>
                <span>{item.customer.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
