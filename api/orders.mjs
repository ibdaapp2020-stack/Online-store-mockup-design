import express from 'express'
import { createFirestoreOrder } from '../server/create-firestore-order.mjs'

const app = express()
app.use(express.json({ limit: '1mb' }))

async function createOrder(req, res) {
  try {
    const order = await createFirestoreOrder({
      customer: req.body?.customer,
      items: req.body?.items,
      coupon: req.body?.coupon,
    })
    res.status(201).json(order)
  } catch (error) {
    const raw = error instanceof Error ? error.message : ''
    const code = String(error?.code || '')
    const denied = raw.toLowerCase().includes('permission')
    const status = Number(error?.httpStatus) || (denied ? 503 : 502)
    const message = denied
      ? 'לא הצלחנו לשמור את ההזמנה. לא בוצע חיוב.'
      : raw || 'לא ניתן לקלוט את ההזמנה'
    console.error('ORDER_API_ERROR', code || 'ORDER_SAVE_FAILED', status)
    res.status(status).json({
      error: message,
      code: code || (denied ? 'ORDER_SAVE_FAILED' : status >= 500 ? 'SERVICE_UNAVAILABLE' : 'ORDER_SAVE_FAILED'),
    })
  }
}

app.post('/', createOrder)
app.post('/orders', createOrder)
app.post('/api/orders', createOrder)

export default app
