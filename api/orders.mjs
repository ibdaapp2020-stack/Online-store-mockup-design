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
    const status = Number(error?.httpStatus) || (String(error?.message || '').includes('permission') ? 403 : 502)
    res.status(status).json({ error: error instanceof Error ? error.message : 'לא ניתן לקלוט את ההזמנה' })
  }
}

app.post('/', createOrder)
app.post('/orders', createOrder)
app.post('/api/orders', createOrder)

export default app
