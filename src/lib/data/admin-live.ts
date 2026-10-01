import { collection, onSnapshot } from 'firebase/firestore'
import { db, orderFrom } from './core'
import { mergeCustomers } from './customers'
import type { Order } from '../../types'

export function watchAdminOrders(onData: (orders: Order[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db(), 'orders'),
    (snap) => {
      const rows = snap.docs.map((item) => orderFrom(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      onData(rows)
    },
    (error) => onError(error instanceof Error ? error : new Error('orders')),
  )
}

export function watchAdminCustomers(onData: (members: Array<Record<string, unknown>>) => void, onError: (error: Error) => void) {
  let orders: Order[] = []
  let registered: Array<Record<string, unknown>> = []
  let ordersReady = false
  let customersReady = false

  function emit() {
    if (!ordersReady || !customersReady) return
    onData(mergeCustomers(registered, orders))
  }

  const stopOrders = onSnapshot(
    collection(db(), 'orders'),
    (snap) => {
      orders = snap.docs.map((item) => orderFrom(item.id, item.data()))
      ordersReady = true
      emit()
    },
    (error) => onError(error instanceof Error ? error : new Error('orders')),
  )
  const stopCustomers = onSnapshot(
    collection(db(), 'customers'),
    (snap) => {
      registered = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
      customersReady = true
      emit()
    },
    (error) => onError(error instanceof Error ? error : new Error('customers')),
  )

  return () => {
    stopOrders()
    stopCustomers()
  }
}
