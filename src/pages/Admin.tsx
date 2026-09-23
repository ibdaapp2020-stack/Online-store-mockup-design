import { Fragment, FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { categories, setups } from '../data'
import { money } from '../pricing'
import { ADMIN_PASSWORD, useStore } from '../store'
import type { CategoryId, OrderStatus, Product } from '../types'
import { Logo } from '../components/ui'

type Tab = 'dash' | 'products' | 'orders'

const statusLabel: Record<OrderStatus, string> = {
  new: 'חדשה',
  processing: 'בטיפול',
  done: 'הושלמה',
  cancelled: 'בוטלה',
}

function blankProduct(): Product {
  return {
    id: `item-${Date.now()}`,
    name: '',
    brand: 'DESIGMA',
    category: 'accessories',
    price: 99,
    blurb: '',
    specs: [],
    fit: 'all',
    stock: 10,
    active: true,
    rating: 5,
    reviews: 0,
  }
}

export function Admin() {
  const {
    admin,
    login,
    logout,
    products,
    orders,
    updateProduct,
    addProduct,
    deleteProduct,
    resetCatalog,
    setOrderStatus,
  } = useStore()
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>('dash')
  const [draft, setDraft] = useState<Product | null>(null)
  const [specsText, setSpecsText] = useState('')
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  if (!admin) {
    return (
      <div className="login">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const ok = login(password)
            setFailed(!ok)
          }}
        >
          <Logo />
          <h1>ניהול החנות</h1>
          <p className="muted">כאן מעדכנים מלאי, מחירים והזמנות שנכנסו מהחנות.</p>
          <label className="field">
            <span>סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {failed && <p className="error">הסיסמה לא נכונה</p>}
          <button className="btn btn-primary" type="submit">
            כניסה
          </button>
          <p className="fine">סיסמת הדגמה: {ADMIN_PASSWORD}</p>
          <Link to="/">חזרה לכניסה</Link>
        </form>
      </div>
    )
  }

  const liveOrders = orders.filter((order) => order.kind === 'order' && order.status !== 'cancelled')
  const revenue = liveOrders.reduce((sum, order) => sum + order.total, 0)
  const privateCount = orders.filter((order) => order.audience === 'private').length
  const businessCount = orders.filter((order) => order.audience === 'business').length

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!draft || draft.name.trim().length < 2 || !Number.isFinite(draft.price) || draft.price <= 0) return
    const next = {
      ...draft,
      name: draft.name.trim(),
      specs: specsText
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    }
    if (products.some((product) => product.id === draft.id)) updateProduct(draft.id, next)
    else addProduct(next)
    setDraft(null)
  }

  const roles = setups.find((setup) => setup.id === draft?.setupId)?.roles ?? []

  return (
    <div className="admin">
      <aside>
        <Logo light />
        <nav>
          <button type="button" className={tab === 'dash' ? 'on' : ''} onClick={() => setTab('dash')}>
            סקירה
          </button>
          <button type="button" className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>
            מוצרים
          </button>
          <button type="button" className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>
            הזמנות
          </button>
        </nav>
        <div className="aside-foot">
          <Link to="/shop">לחנות</Link>
          <button type="button" onClick={logout}>
            יציאה
          </button>
        </div>
      </aside>
      <section className="admin-main">
        {tab === 'dash' && (
          <>
            <h1>סקירה</h1>
            <div className="kpis">
              <article>
                <span>הזמנות פעילות</span>
                <strong>{liveOrders.length}</strong>
              </article>
              <article>
                <span>הצעות מחיר</span>
                <strong>{orders.filter((order) => order.kind === 'quote').length}</strong>
              </article>
              <article>
                <span>מחזור כולל מע״מ</span>
                <strong>{money(revenue)}</strong>
              </article>
              <article>
                <span>פרטי / עסקי</span>
                <strong>
                  {privateCount} / {businessCount}
                </strong>
              </article>
            </div>
            {orders.length === 0 ? (
              <p className="empty-inline">עדיין אין הזמנות. קנייה בחנות תופיע כאן.</p>
            ) : (
              <OrderTable
                orders={orders.slice(0, 6)}
                openOrder={openOrder}
                setOpenOrder={setOpenOrder}
                setOrderStatus={setOrderStatus}
              />
            )}
          </>
        )}

        {tab === 'products' && (
          <>
            <div className="sec-head">
              <h1>מוצרים</h1>
              <div className="hero-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const product = blankProduct()
                    setDraft(product)
                    setSpecsText('')
                  }}
                >
                  מוצר חדש
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (window.confirm('להחזיר את הקטלוג המקורי? שינויי המוצרים יימחקו.')) resetCatalog()
                  }}
                >
                  שחזור קטלוג
                </button>
              </div>
            </div>
            {draft && (
              <form className="editor" onSubmit={save}>
                <div className="form-grid">
                  <label className="field">
                    <span>שם</span>
                    <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>מותג</span>
                    <input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>מחיר לצרכן כולל מע״מ</span>
                    <input
                      type="number"
                      min={1}
                      value={draft.price}
                      onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>מלאי</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.stock}
                      onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>קטגוריה</span>
                    <select
                      value={draft.category}
                      onChange={(event) => setDraft({ ...draft, category: event.target.value as CategoryId })}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>התאמה</span>
                    <select
                      value={draft.fit}
                      onChange={(event) => setDraft({ ...draft, fit: event.target.value as Product['fit'] })}
                    >
                      <option value="all">כולם</option>
                      <option value="private">פרטי</option>
                      <option value="business">עסקי</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>סטאפ</span>
                    <select
                      value={draft.setupId ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, setupId: event.target.value || undefined, role: undefined })
                      }
                    >
                      <option value="">בלי סטאפ</option>
                      {setups.map((setup) => (
                        <option key={setup.id} value={setup.id}>
                          {setup.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>תפקיד במד</span>
                    <select
                      value={draft.role ?? ''}
                      onChange={(event) => setDraft({ ...draft, role: event.target.value || undefined })}
                    >
                      <option value="">ללא</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>תווית</span>
                    <input
                      value={draft.badge ?? ''}
                      onChange={(event) => setDraft({ ...draft, badge: event.target.value || undefined })}
                    />
                  </label>
                  <label className="field wide">
                    <span>תיאור</span>
                    <input value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} />
                  </label>
                  <label className="field wide">
                    <span>מפרט, מופרד בפסיקים</span>
                    <input value={specsText} onChange={(event) => setSpecsText(event.target.value)} />
                  </label>
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                    />
                    פעיל בחנות
                  </label>
                </div>
                <div className="hero-actions">
                  <button className="btn btn-primary" type="submit">
                    שמירה
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => setDraft(null)}>
                    ביטול
                  </button>
                </div>
              </form>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>קטגוריה</th>
                    <th>מחיר</th>
                    <th>מלאי</th>
                    <th>סטטוס</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{categories.find((category) => category.id === product.category)?.name}</td>
                      <td>{money(product.price)}</td>
                      <td>{product.stock}</td>
                      <td>{product.active ? 'פעיל' : 'מוסתר'}</td>
                      <td className="actions">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(product)
                            setSpecsText(product.specs.join(', '))
                          }}
                        >
                          עריכה
                        </button>
                        <button
                          type="button"
                          onClick={() => updateProduct(product.id, { active: !product.active })}
                        >
                          {product.active ? 'הסתרה' : 'הצגה'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`למחוק את ${product.name}?`)) deleteProduct(product.id)
                          }}
                        >
                          מחיקה
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'orders' && (
          <>
            <h1>הזמנות</h1>
            {orders.length === 0 ? (
              <p className="empty-inline">אין עדיין הזמנות או הצעות מחיר.</p>
            ) : (
              <OrderTable
                orders={orders}
                openOrder={openOrder}
                setOpenOrder={setOpenOrder}
                setOrderStatus={setOrderStatus}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}

function OrderTable({
  orders,
  openOrder,
  setOpenOrder,
  setOrderStatus,
}: {
  orders: ReturnType<typeof useStore>['orders']
  openOrder: string | null
  setOpenOrder: (id: string | null) => void
  setOrderStatus: (id: string, status: OrderStatus) => void
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>מספר</th>
            <th>תאריך</th>
            <th>קהל</th>
            <th>סוג</th>
            <th>לקוח</th>
            <th>סכום</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <Fragment key={order.id}>
              <tr>
                <td>
                  <button type="button" className="linkish" onClick={() => setOpenOrder(openOrder === order.id ? null : order.id)}>
                    {order.id}
                  </button>
                </td>
                <td>{new Date(order.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{order.audience === 'business' ? 'עסקי' : 'פרטי'}</td>
                <td>{order.kind === 'quote' ? 'הצעה' : 'הזמנה'}</td>
                <td>{order.customer.name}</td>
                <td>{money(order.total)}</td>
                <td>
                  <select value={order.status} onChange={(event) => setOrderStatus(order.id, event.target.value as OrderStatus)}>
                    {Object.entries(statusLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              {openOrder === order.id && (
                <tr>
                  <td colSpan={7}>
                    <p>
                      {order.customer.phone} · {order.customer.address}
                    </p>
                    <p>{order.payment}</p>
                    {order.customer.note && <p>{order.customer.note}</p>}
                    <ul>
                      {order.lines.map((line) => (
                        <li key={line.productId}>
                          {line.name} × {line.qty} · {money(line.unit * line.qty)}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
