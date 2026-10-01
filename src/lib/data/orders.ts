import { doc, getDoc, runTransaction } from 'firebase/firestore'
import { quote } from '../../pricing'
import type { Customer, Order } from '../../types'
import { optionStock } from '../../types'
import { db, getSettings, orderFrom, productFrom } from './core'
import { currentUser } from './auth'

export async function placeStoreOrder(customer: Customer, lines: Array<{ productId: string; qty: number; size?: string; color?: string; other?: string }>, coupon: string | null) {
  if (!customer.name.trim() || !customer.phone.trim() || !customer.city.trim() || !customer.address.trim() || !lines.length) {
    throw new Error('חסרים פרטי הזמנה')
  }
  const settings = await getSettings()
  const couponOn = Boolean(coupon && coupon.trim().toUpperCase() === settings.couponCode.toUpperCase())
  const uid = currentUser()?.uid

  const stockAfter: Array<{ id: string; name: string; previous: number; stock: number }> = []
  const order = await runTransaction(db(), async (tx) => {
    stockAfter.length = 0
    const counterRef = doc(db(), 'settings', 'counters')
    const counterSnap = await tx.get(counterRef)
    const last = Number(counterSnap.data()?.lastOrder) || 10040
    const orderId = `MED-${last + 1}`
    const items: Order['items'] = []

    for (const line of lines) {
      const productRef = doc(db(), 'products', line.productId)
      const snap = await tx.get(productRef)
      if (!snap.exists()) throw new Error('מוצר לא זמין')
      const product = productFrom(snap.id, snap.data())
      const qty = Number(line.qty)
      if (!product.active || !Number.isInteger(qty) || qty < 1) throw new Error('מוצר לא זמין')
      const available = optionStock(product, line)
      if (available < qty) throw new Error(`אין מספיק מלאי עבור ${product.name}`)
      if (product.variants?.length) {
        const next = product.variants.map((row) => {
          const match = (!line.size || row.size === line.size) && (!line.color || row.color === line.color) && (!line.other || row.other === line.other)
          if (!match) return row
          return { ...row, stock: row.stock - qty }
        })
        if (next.some((row) => row.stock < 0)) throw new Error(`אין מספיק מלאי עבור ${product.name}`)
        const nextStock = next.reduce((sum, row) => sum + row.stock, 0)
        tx.update(productRef, { variants: next, stock: nextStock, updatedAt: new Date().toISOString() })
        stockAfter.push({ id: product.id, name: product.name, previous: product.stock, stock: nextStock })
      } else {
        tx.update(productRef, { stock: product.stock - qty, updatedAt: new Date().toISOString() })
        stockAfter.push({ id: product.id, name: product.name, previous: product.stock, stock: product.stock - qty })
      }
      items.push({ productId: product.id, name: product.name, price: product.price, qty, size: line.size, color: line.color })
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    const priced = quote(subtotal, couponOn, settings)
    const created: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'received',
      customer: { ...customer, customerId: uid },
      items,
      ...priced,
      coupon: couponOn ? settings.couponCode : undefined,
    }
    tx.set(doc(db(), 'orders', orderId), created)
    tx.set(counterRef, { lastOrder: last + 1 }, { merge: true })
    return created
  })

  return { order, stockAfter }
}

export async function findStoreOrder(id: string) {
  const snap = await getDoc(doc(db(), 'orders', id))
  if (!snap.exists()) return null
  return orderFrom(snap.id, snap.data())
}
