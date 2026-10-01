import { brevoAccount, brevoSend } from './brevo.mjs'
import { emailConfig, isValidEmail, resolveLang } from './config.mjs'
import {
  getDelivery,
  getDeliveryById,
  listDeliveries,
  mapDelivery,
  markFailed,
  markSent,
  markSkipped,
  notificationFlags,
  saveNotificationFlags,
  setStockArmed,
  stockArmed,
  upsertPending,
} from './store.mjs'
import {
  renderAdminNewOrder,
  renderAdminPayment,
  renderAdminPaymentFailed,
  renderCustomerOrder,
  renderCustomerPayment,
  renderCustomerPaymentFailed,
  renderOrderStatus,
  renderStockAlert,
  renderTestEmail,
  STATUS_COPY,
} from './templates.mjs'

export function previewEmail(type, lang = 'he') {
  const resolved = resolveLang(lang)
  const sample = {
    id: 'MED-TEST',
    createdAt: new Date().toISOString(),
    status: type === 'status' ? 'packing' : 'received',
    customer: { name: 'לקוח בדיקה', phone: '050-0000000', email: 'abulieltasneem23@gmail.com', city: 'באר שבע', address: 'כתובת בדיקה' },
    items: [{ productId: 'kit', name: 'ערכת עזרה ראשונה ביתית', price: 89, qty: 1 }],
    total: 89,
  }
  if (type === 'admin-order') return renderAdminNewOrder(sample, resolved)
  if (type === 'customer-order') return renderCustomerOrder(sample, resolved)
  if (type === 'admin-payment') return renderAdminPayment(sample, { amount: 89, method: 'verified', reference: 'TEST' }, resolved)
  if (type === 'customer-payment') return renderCustomerPayment(sample, { amount: 89 }, resolved)
  if (type === 'status') return renderOrderStatus({ ...sample, status: 'packing' }, resolved)
  return renderTestEmail(resolved)
}

async function deliver({ key, type, to, toName, subject, html, text, entityType, entityId, retry = false }) {
  const existing = getDelivery(key)
  if (existing && !retry && (existing.status === 'SENT' || existing.status === 'SKIPPED' || existing.status === 'PENDING')) {
    return mapDelivery(existing)
  }
  if (existing && !retry && existing.status === 'FAILED') {
    return mapDelivery(existing)
  }
  upsertPending({ key, type, recipient: to, subject, entityType, entityId, html, text })
  try {
    const sent = await brevoSend({ to, toName, subject, html, text, tags: [type] })
    return mapDelivery(markSent(key, sent.messageId))
  } catch (error) {
    return mapDelivery(markFailed(key, error.code || error.message))
  }
}

export async function sendEmail(input) {
  return deliver(input)
}

export async function sendAdminEmail({ type, subject, html, text, key, entityType, entityId, retry }) {
  const config = emailConfig()
  return deliver({
    key,
    type,
    to: config.adminEmail,
    toName: 'PRO PHARM Admin',
    subject,
    html,
    text,
    entityType,
    entityId,
    retry,
  })
}

export async function sendCustomerEmail({ type, to, toName, subject, html, text, key, entityType, entityId, retry }) {
  if (!isValidEmail(to)) {
    return mapDelivery(markSkipped({ key, type, recipient: to || '', subject, entityType, entityId, errorCode: 'SKIPPED_NO_EMAIL' }))
  }
  return deliver({ key, type, to, toName, subject, html, text, entityType, entityId, retry })
}

export async function sendOrderConfirmation(order, lang) {
  const resolved = resolveLang(lang || order.customer?.language)
  const template = renderCustomerOrder(order, resolved)
  return sendCustomerEmail({
    type: 'ORDER_CREATED_CUSTOMER',
    to: order.customer?.email,
    toName: order.customer?.name,
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `ORDER_CREATED:${order.id}:CUSTOMER`,
    entityType: 'order',
    entityId: order.id,
  })
}

export async function sendAdminNewOrder(order, lang) {
  if (!notificationFlags().newOrder) return { status: 'SKIPPED', errorCode: 'DISABLED' }
  const resolved = resolveLang(lang)
  const template = renderAdminNewOrder(order, resolved)
  return sendAdminEmail({
    type: 'ORDER_CREATED_ADMIN',
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `ORDER_CREATED:${order.id}:ADMIN`,
    entityType: 'order',
    entityId: order.id,
  })
}

export async function sendOrderStatusChanged(order, lang) {
  const resolved = resolveLang(lang || order.customer?.language)
  const template = renderOrderStatus(order, resolved)
  if (!template) return { status: 'SKIPPED', errorCode: 'NO_CUSTOMER_STATUS' }
  return sendCustomerEmail({
    type: 'ORDER_STATUS_CUSTOMER',
    to: order.customer?.email,
    toName: order.customer?.name,
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `ORDER_STATUS:${order.id}:${order.status}:CUSTOMER`,
    entityType: 'order',
    entityId: order.id,
  })
}

export async function sendPaymentConfirmation(order, payment, lang) {
  const resolved = resolveLang(lang || order.customer?.language)
  const template = renderCustomerPayment(order, payment, resolved)
  return sendCustomerEmail({
    type: 'PAYMENT_RECEIVED_CUSTOMER',
    to: order.customer?.email,
    toName: order.customer?.name,
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `PAYMENT_RECEIVED:${payment?.id || order.id}:CUSTOMER`,
    entityType: 'payment',
    entityId: payment?.id || order.id,
  })
}

export async function sendAdminPaymentReceived(order, payment, lang) {
  if (!notificationFlags().paymentReceived) return { status: 'SKIPPED', errorCode: 'DISABLED' }
  const resolved = resolveLang(lang)
  const template = renderAdminPayment(order, payment, resolved)
  return sendAdminEmail({
    type: 'PAYMENT_RECEIVED_ADMIN',
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `PAYMENT_RECEIVED:${payment?.id || order.id}:ADMIN`,
    entityType: 'payment',
    entityId: payment?.id || order.id,
  })
}

export async function sendAdminPaymentProblem(order, detail, lang) {
  if (!notificationFlags().paymentProblem) return { status: 'SKIPPED', errorCode: 'DISABLED' }
  const resolved = resolveLang(lang)
  const template = renderAdminPaymentFailed(order, detail, resolved)
  return sendAdminEmail({
    type: 'PAYMENT_PROBLEM_ADMIN',
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `PAYMENT_PROBLEM:${order.id}:ADMIN`,
    entityType: 'order',
    entityId: order.id,
  })
}

export async function sendCustomerPaymentFailed(order, lang) {
  const resolved = resolveLang(lang || order.customer?.language)
  const template = renderCustomerPaymentFailed(order, resolved)
  return sendCustomerEmail({
    type: 'PAYMENT_FAILED_CUSTOMER',
    to: order.customer?.email,
    toName: order.customer?.name,
    subject: template.subject,
    html: template.html,
    text: template.text,
    key: `PAYMENT_FAILED:${order.id}:CUSTOMER`,
    entityType: 'order',
    entityId: order.id,
  })
}

export async function sendImportantAdminAlert({ type, subject, html, text, key, entityType, entityId }) {
  if (!notificationFlags().systemAlerts && type === 'IMPORTANT_SYSTEM_ERROR') return { status: 'SKIPPED', errorCode: 'DISABLED' }
  return sendAdminEmail({ type, subject, html, text, key, entityType, entityId })
}

export async function notifyOrderCreated(order, lang) {
  const admin = await sendAdminNewOrder(order, lang)
  const customer = await sendOrderConfirmation(order, lang)
  return { admin, customer }
}

export async function notifyVerifiedPayment(order, payment, lang) {
  if (!payment?.verified) return { status: 'SKIPPED', errorCode: 'UNVERIFIED_PAYMENT' }
  const admin = await sendAdminPaymentReceived(order, payment, lang)
  const customer = await sendPaymentConfirmation(order, payment, lang)
  return { admin, customer }
}

export async function notifyStockChange({ productId, name, previous, next }) {
  const flags = notificationFlags()
  const threshold = emailConfig().lowStockThreshold
  const lang = 'he'
  const product = { id: productId, name: name || productId }
  const results = []
  if (next > 0) setStockArmed(productId, true)
  if (flags.outOfStock && previous > 0 && next === 0 && stockArmed(productId)) {
    const copy = STATUS_COPY.he
    const template = renderStockAlert({ title: copy.outOfStock, product, stock: 0, lang })
    results.push(
      await sendAdminEmail({
        type: 'OUT_OF_STOCK',
        subject: template.subject,
        html: template.html,
        text: template.text,
        key: `OUT_OF_STOCK:${productId}`,
        entityType: 'product',
        entityId: productId,
      }),
    )
    setStockArmed(productId, false)
  }
  if (flags.lowStock && next > 0 && next <= threshold) {
    const copy = STATUS_COPY.he
    const template = renderStockAlert({ title: copy.lowStock, product, stock: next, lang })
    results.push(
      await sendAdminEmail({
        type: 'LOW_STOCK',
        subject: template.subject,
        html: template.html,
        text: template.text,
        key: `LOW_STOCK:${productId}:${next}`,
        entityType: 'product',
        entityId: productId,
      }),
    )
  }
  return results
}

export async function sendTestEmail(to, lang = 'he') {
  const recipient = isValidEmail(to) ? to.trim() : 'abulieltasneem23@gmail.com'
  const template = renderTestEmail(resolveLang(lang))
  return deliver({
    key: `TEST:${recipient}:${Date.now()}`,
    type: 'TEST',
    to: recipient,
    toName: 'PRO PHARM Test',
    subject: template.subject,
    html: template.html,
    text: template.text,
    entityType: 'test',
    entityId: recipient,
    retry: true,
  })
}

export async function retryDelivery(id) {
  const row = getDeliveryById(id)
  if (!row) return { error: 'המשלוח לא נמצא' }
  if (row.status === 'SENT') return mapDelivery(row)
  return deliver({
    key: row.idempotency_key,
    type: row.type,
    to: row.recipient,
    subject: row.subject,
    html: row.html || previewEmail('test').html,
    text: row.text_body || row.subject,
    entityType: row.entity_type,
    entityId: row.entity_id,
    retry: true,
  })
}

export async function connectionStatus() {
  const config = emailConfig()
  const account = await brevoAccount().catch((error) => ({ ok: false, error: error.message }))
  return {
    provider: 'Brevo',
    sender: `${config.senderName} <${config.senderEmail}>`,
    adminEmail: config.adminEmail,
    connected: Boolean(account.ok),
    error: account.ok ? '' : account.error || 'Error',
    flags: notificationFlags(),
  }
}

export function emailHistory() {
  return listDeliveries().map(mapDelivery)
}

export function emailDetail(id) {
  return mapDelivery(getDeliveryById(id))
}

export { saveNotificationFlags, notificationFlags }
