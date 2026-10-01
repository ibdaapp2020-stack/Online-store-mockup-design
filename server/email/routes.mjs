import { emailConfig, isValidEmail } from './config.mjs'
import {
  connectionStatus,
  emailDetail,
  emailHistory,
  notifyOrderCreated,
  notifyStockChange,
  notifyVerifiedPayment,
  previewEmail,
  retryDelivery,
  saveNotificationFlags,
  sendOrderStatusChanged,
  sendTestEmail,
} from './service.mjs'

async function adminEmailFromToken(req) {
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !process.env.VITE_FIREBASE_API_KEY) return ''
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  })
  const payload = await response.json().catch(() => ({}))
  return String(payload.users?.[0]?.email || '')
}

function allowedAdmin(email) {
  const allowed = [emailConfig().adminEmail, process.env.FIREBASE_ADMIN_EMAIL, process.env.PROPHARM_ADMIN_EMAIL]
    .filter(Boolean)
    .map((value) => value.toLowerCase())
  return allowed.includes(String(email || '').toLowerCase())
}

export function registerEmailRoutes(app, { requireAdmin }) {
  async function requireMailAdmin(req, res, next) {
    const email = await adminEmailFromToken(req).catch(() => '')
    if (allowedAdmin(email)) return next()
    return requireAdmin(req, res, next)
  }

  app.get('/api/admin/email/status', requireMailAdmin, async (_req, res) => {
    res.json(await connectionStatus())
  })

  app.patch('/api/admin/email/settings', requireMailAdmin, (req, res) => {
    res.json(saveNotificationFlags(req.body || {}))
  })

  app.get('/api/admin/email/deliveries', requireMailAdmin, (_req, res) => {
    res.json(emailHistory())
  })

  app.get('/api/admin/email/deliveries/:id', requireMailAdmin, (req, res) => {
    const row = emailDetail(req.params.id)
    if (!row) return res.status(404).json({ error: 'המשלוח לא נמצא' })
    res.json(row)
  })

  app.post('/api/admin/email/deliveries/:id/retry', requireMailAdmin, async (req, res) => {
    res.json(await retryDelivery(req.params.id))
  })

  app.get('/api/admin/email/preview', requireMailAdmin, (req, res) => {
    res.json(previewEmail(String(req.query.type || 'test'), String(req.query.lang || 'he')))
  })

  app.post('/api/admin/email/test', requireMailAdmin, async (req, res) => {
    const to = isValidEmail(req.body?.to) ? String(req.body.to).trim() : 'abulieltasneem23@gmail.com'
    const result = await sendTestEmail(to, req.body?.lang)
    res.status(result.status === 'SENT' ? 200 : 502).json(result)
  })

  app.post('/api/notify/order-created', async (req, res) => {
    const order = req.body?.order
    if (!order?.id || !Array.isArray(order.items)) return res.status(400).json({ error: 'הזמנה לא תקינה' })
    const result = await notifyOrderCreated(order, req.body?.language)
    const stock = Array.isArray(req.body?.stockAfter) ? req.body.stockAfter : []
    for (const item of stock) {
      await notifyStockChange({
        productId: item.id || item.productId,
        name: item.name,
        previous: Number(item.previous),
        next: Number(item.stock ?? item.next),
      }).catch(() => {})
    }
    res.json(result)
  })

  app.post('/api/notify/order-status', async (req, res) => {
    const order = req.body?.order
    if (!order?.id || !order.status) return res.status(400).json({ error: 'הזמנה לא תקינה' })
    res.json(await sendOrderStatusChanged(order, req.body?.language))
  })

  app.post('/api/notify/stock', async (req, res) => {
    res.json(await notifyStockChange(req.body || {}))
  })

  app.post('/api/notify/payment-confirmed', requireMailAdmin, async (req, res) => {
    const order = req.body?.order
    const payment = req.body?.payment
    if (!order?.id || !payment?.verified) return res.status(400).json({ error: 'אין אישור תשלום מאומת' })
    res.json(await notifyVerifiedPayment(order, payment, req.body?.language))
  })
}
