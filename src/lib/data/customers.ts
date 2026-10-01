import type { Order } from '../../types'

export function customerKey(customer: { customerId?: string; email?: string; phone?: string } | undefined) {
  const existing = String(customer?.customerId || '').trim()
  if (existing) return existing
  const email = String(customer?.email || '').trim().toLowerCase()
  const phone = String(customer?.phone || '').replace(/\D/g, '')
  if (email) return `mail-${email}`
  if (phone) return `tel-${phone}`
  return ''
}

export function mergeCustomers(registered: Array<Record<string, unknown>>, orders: Order[]) {
  const map = new Map<string, Record<string, unknown>>()
  for (const order of orders) {
    const customer = order.customer || { name: '', phone: '' }
    const id = customerKey(customer) || `order-${order.id}`
    const prev = map.get(id) || {}
    map.set(id, {
      id,
      name: customer.name || prev.name || '',
      phone: customer.phone || prev.phone || '',
      email: customer.email || prev.email || '',
      city: customer.city || prev.city || '',
      address: customer.address || prev.address || '',
      points: Number(prev.points) || 0,
      nextPercent: Number(prev.nextPercent) || 0,
      couponCode: prev.couponCode || '',
      couponPercent: Number(prev.couponPercent) || 0,
      lastOrderId: order.id,
      lastOrderAt: order.createdAt,
    })
  }
  for (const item of registered) {
    const id = String(item.id || '')
    if (!id) continue
    map.set(id, { ...(map.get(id) || {}), ...item, id })
  }
  return [...map.values()]
}
